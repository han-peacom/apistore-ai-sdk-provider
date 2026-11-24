# API Store Provider for the Vercel AI SDK

The API Store provider for the [AI SDK](https://ai-sdk.dev) gives you Claude, GPT, Gemini and DeepSeek chat models under one API key, through the [API Store](https://apistore.cloud) OpenAI-compatible Chat Completions API.

It supports text generation, streaming, tool calling, structured output (JSON schema), image and PDF input, and reasoning output.

## Setup

```bash
npm install @apistore/ai-sdk-provider ai
```

Get an API key from [API Store](https://apistore.cloud) and set it as an environment variable:

```bash
APISTORE_API_KEY=your-api-key
```

## Provider Instance

Import the default provider instance `apistore`. It reads the key from `APISTORE_API_KEY`:

```ts
import { apistore } from '@apistore/ai-sdk-provider';
```

For a custom setup, use `createApiStore`:

```ts
import { createApiStore } from '@apistore/ai-sdk-provider';

const apistore = createApiStore({
  apiKey: process.env.APISTORE_API_KEY,
});
```

Settings (all optional):

| Setting   | Type                                | Description                                                                         |
| --------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `apiKey`  | `string \| () => string \| Promise` | API key sent as `Authorization: Bearer <key>`. Defaults to `APISTORE_API_KEY`.      |
| `baseURL` | `string`                            | URL prefix for API calls. Defaults to `https://api.apistore.cloud/v1`.              |
| `headers` | `Record<string, string>`            | Extra headers sent with every request.                                              |
| `fetch`   | `typeof fetch`                      | Custom fetch implementation, e.g. for middleware or testing.                         |

## Models

Pass a model ID to the provider:

```ts
const model = apistore('claude-sonnet-5-5');
```

Model IDs are typed for autocompletion, and any other ID the API accepts can be passed as a string. Some of the models available:

- **Claude**: `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-4-8`
- **GPT**: `gpt-6.2-sol`, `gpt-6.2-astra`, `gpt-6-luna`, `gpt-5.5`
- **Gemini**: `gemini-4-argon`, `gemini-4-carbon`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`
- **DeepSeek**: `deepseek-v4-1-flash`, `deepseek-v4-1-flash-economy`

The full list is at `GET https://api.apistore.cloud/v1/models` and in the [API Store documentation](https://apistore.cloud/docs).

## Examples

### Generate text

```ts
import { apistore } from '@apistore/ai-sdk-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: apistore('claude-sonnet-5-5'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});

console.log(text);
```

### Stream text

```ts
import { apistore } from '@apistore/ai-sdk-provider';
import { streamText } from 'ai';

const result = streamText({
  model: apistore('gpt-6.2-sol'),
  prompt: 'Write a short story about a lighthouse keeper.',
});

for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}

console.log('\nUsage:', await result.usage);
```

### Tools

```ts
import { apistore } from '@apistore/ai-sdk-provider';
import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';

const { text } = await generateText({
  model: apistore('gemini-4-argon'),
  tools: {
    weather: tool({
      description: 'Get the weather in a city',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ city, temperatureC: 18 }),
    }),
  },
  stopWhen: stepCountIs(5),
  prompt: 'What is the weather in Paris?',
});
```

### Structured output

```ts
import { apistore } from '@apistore/ai-sdk-provider';
import { generateText, Output } from 'ai';
import { z } from 'zod';

const { output } = await generateText({
  model: apistore('gpt-6.2-sol'),
  output: Output.object({
    schema: z.object({
      name: z.string(),
      ingredients: z.array(z.string()),
    }),
  }),
  prompt: 'Generate a lasagna recipe.',
});
```

### Image and PDF input

```ts
import { apistore } from '@apistore/ai-sdk-provider';
import { generateText } from 'ai';
import { readFile } from 'node:fs/promises';

const { text } = await generateText({
  model: apistore('claude-sonnet-5-5'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Summarize this report and describe the chart.' },
        {
          type: 'file',
          data: await readFile('./report.pdf'),
          mediaType: 'application/pdf',
          filename: 'report.pdf',
        },
        { type: 'image', image: await readFile('./chart.png') },
      ],
    },
  ],
});
```

Image and PDF input works with the Claude, GPT and Gemini models. PDFs are sent as file data (PDF URLs are not supported).

### Reasoning

Set the reasoning effort with the AI SDK `reasoning` option (or the `reasoningEffort` provider option). Models that return their reasoning, such as Claude, expose it as `reasoningText`:

```ts
import { apistore } from '@apistore/ai-sdk-provider';
import { generateText } from 'ai';

const { text, reasoningText } = await generateText({
  model: apistore('claude-opus-5-5'),
  reasoning: 'high',
  prompt: 'How many prime numbers are there between 1 and 100?',
});
```

```ts
const result = await generateText({
  model: apistore('gpt-6.2-sol'),
  prompt: 'Plan a three-day trip to Kyoto.',
  providerOptions: {
    apistore: { reasoningEffort: 'medium' },
  },
});
```

## Development

```bash
npm install
npm run type-check
npm test
npm run build
```

## License

MIT
