import { generateText, jsonSchema, Output, streamText, tool } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apistore, createApiStore } from './index';

type Captured = { url: string; headers: Record<string, string>; body: any };

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function sseResponse(chunks: unknown[]) {
  const text =
    chunks.map(c => `data: ${JSON.stringify(c)}\n\n`).join('') +
    'data: [DONE]\n\n';
  return new Response(text, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function mockFetch(respond: () => Response) {
  const calls: Captured[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: input.toString(),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    return respond();
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const completion = (message: Record<string, unknown>, finish = 'stop') => ({
  id: 'chatcmpl-1',
  object: 'chat.completion',
  created: 1_700_000_000,
  model: 'claude-sonnet-5',
  choices: [{ index: 0, message: { role: 'assistant', ...message }, finish_reason: finish }],
  usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createApiStore', () => {
  it('sends chat completions to the default base URL with a bearer key', async () => {
    const { fetch, calls } = mockFetch(() =>
      jsonResponse(completion({ content: 'Hello!' })),
    );
    const provider = createApiStore({ apiKey: 'test-key', fetch });

    const result = await generateText({
      model: provider('claude-sonnet-5'),
      prompt: 'Say hello',
    });

    expect(result.text).toBe('Hello!');
    expect(result.usage.inputTokens).toBe(12);
    expect(result.usage.outputTokens).toBe(8);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.apistore.cloud/v1/chat/completions');
    expect(calls[0]!.headers.authorization).toBe('Bearer test-key');
    expect(calls[0]!.body.model).toBe('claude-sonnet-5');
    expect(calls[0]!.body.messages).toEqual([
      { role: 'user', content: 'Say hello' },
    ]);
  });

  it('reads the key from APISTORE_API_KEY', async () => {
    vi.stubEnv('APISTORE_API_KEY', 'env-key');
    const { fetch, calls } = mockFetch(() =>
      jsonResponse(completion({ content: 'ok' })),
    );
    await generateText({
      model: createApiStore({ fetch })('gpt-5.5'),
      prompt: 'hi',
    });
    expect(calls[0]!.headers.authorization).toBe('Bearer env-key');
  });

  it('fails clearly when no key is set', async () => {
    vi.stubEnv('APISTORE_API_KEY', undefined);
    const { fetch } = mockFetch(() => jsonResponse(completion({ content: 'ok' })));
    await expect(
      generateText({ model: createApiStore({ fetch })('gpt-5.5'), prompt: 'hi' }),
    ).rejects.toThrow(/APISTORE_API_KEY/);
  });

  it('honours a custom baseURL and headers', async () => {
    const { fetch, calls } = mockFetch(() =>
      jsonResponse(completion({ content: 'ok' })),
    );
    const provider = createApiStore({
      apiKey: 'k',
      baseURL: 'https://proxy.example.com/v1/',
      headers: { 'x-custom': 'yes' },
      fetch,
    });
    await generateText({ model: provider.chatModel('gemini-3.8-flash'), prompt: 'hi' });
    expect(calls[0]!.url).toBe('https://proxy.example.com/v1/chat/completions');
    expect(calls[0]!.headers['x-custom']).toBe('yes');
  });

  it('accepts model ids outside the typed list', () => {
    const model = createApiStore({ apiKey: 'k' })('some-future-model');
    expect(model.modelId).toBe('some-future-model');
    expect(model.provider).toBe('apistore.chat');
    expect(apistore.languageModel('claude-opus-5').modelId).toBe('claude-opus-5');
  });

  it('throws NoSuchModelError for embedding and image models', () => {
    const provider = createApiStore({ apiKey: 'k' });
    expect(() => provider.embeddingModel('x')).toThrow(/No such embeddingModel/);
    expect(() => provider.imageModel('x')).toThrow(/No such imageModel/);
  });
});

describe('chat features', () => {
  it('returns reasoning from reasoning_content and sends reasoning_effort', async () => {
    const { fetch, calls } = mockFetch(() =>
      jsonResponse(
        completion({ content: '42', reasoning_content: 'Thinking it through.' }),
      ),
    );
    const result = await generateText({
      model: createApiStore({ apiKey: 'k', fetch })('claude-opus-5'),
      prompt: 'What is 6 x 7?',
      providerOptions: { apistore: { reasoningEffort: 'high' } },
    });
    expect(result.text).toBe('42');
    expect(result.reasoningText).toBe('Thinking it through.');
    expect(calls[0]!.body.reasoning_effort).toBe('high');
  });

  it('maps the top-level reasoning option to reasoning_effort', async () => {
    const { fetch, calls } = mockFetch(() =>
      jsonResponse(completion({ content: 'ok' })),
    );
    await generateText({
      model: createApiStore({ apiKey: 'k', fetch })('gpt-6.2-sol'),
      prompt: 'hi',
      reasoning: 'low',
    });
    expect(calls[0]!.body.reasoning_effort).toBe('low');
  });

  it('sends image and PDF input as content parts', async () => {
    const { fetch, calls } = mockFetch(() =>
      jsonResponse(completion({ content: 'A cat and a report.' })),
    );
    await generateText({
      model: createApiStore({ apiKey: 'k', fetch })('claude-sonnet-5-5'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe these.' },
            { type: 'image', image: new Uint8Array([137, 80, 78, 71]), mediaType: 'image/png' },
            { type: 'file', data: new Uint8Array([37, 80, 68, 70]), mediaType: 'application/pdf', filename: 'report.pdf' },
          ],
        },
      ],
    });
    const parts = calls[0]!.body.messages[0].content;
    expect(parts[0]).toEqual({ type: 'text', text: 'Describe these.' });
    expect(parts[1].type).toBe('image_url');
    expect(parts[1].image_url.url).toMatch(/^data:image\/png;base64,/);
    expect(parts[2].type).toBe('file');
    expect(parts[2].file.file_data).toMatch(/^data:application\/pdf;base64,/);
  });

  it('sends tools and returns tool calls', async () => {
    const { fetch, calls } = mockFetch(() =>
      jsonResponse(
        completion(
          {
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'weather', arguments: '{"city":"Paris"}' },
              },
            ],
          },
          'tool_calls',
        ),
      ),
    );
    const result = await generateText({
      model: createApiStore({ apiKey: 'k', fetch })('gpt-5.5'),
      prompt: 'Weather in Paris?',
      tools: {
        weather: tool({
          description: 'Get the weather',
          inputSchema: jsonSchema<{ city: string }>({
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city'],
          }),
        }),
      },
    });
    expect(calls[0]!.body.tools[0].function.name).toBe('weather');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.toolName).toBe('weather');
    expect(result.toolCalls[0]!.input).toEqual({ city: 'Paris' });
    expect(result.finishReason).toBe('tool-calls');
  });

  it('sends a json_schema response_format for structured output', async () => {
    const { fetch, calls } = mockFetch(() =>
      jsonResponse(completion({ content: '{"name":"Ada"}' })),
    );
    const result = await generateText({
      model: createApiStore({ apiKey: 'k', fetch })('gemini-4-argon'),
      prompt: 'A name',
      output: Output.object({
        schema: jsonSchema<{ name: string }>({
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: false,
        }),
      }),
    });
    expect(calls[0]!.body.response_format.type).toBe('json_schema');
    expect(result.output).toEqual({ name: 'Ada' });
  });

  it('streams text and reasoning and asks for usage', async () => {
    const base = { id: 'c1', object: 'chat.completion.chunk', created: 1, model: 'claude-sonnet-5' };
    const { fetch, calls } = mockFetch(() =>
      sseResponse([
        { ...base, choices: [{ index: 0, delta: { role: 'assistant', reasoning_content: 'Hmm. ' } }] },
        { ...base, choices: [{ index: 0, delta: { content: 'Hello' } }] },
        { ...base, choices: [{ index: 0, delta: { content: ', world' } }] },
        { ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
        { ...base, choices: [], usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 } },
      ]),
    );
    const result = streamText({
      model: createApiStore({ apiKey: 'k', fetch })('claude-sonnet-5'),
      prompt: 'Say hello',
    });

    let text = '';
    for await (const delta of result.textStream) text += delta;

    expect(text).toBe('Hello, world');
    expect(await result.reasoningText).toBe('Hmm. ');
    expect((await result.usage).outputTokens).toBe(4);
    expect(calls[0]!.body.stream).toBe(true);
    expect(calls[0]!.body.stream_options).toEqual({ include_usage: true });
  });
});
