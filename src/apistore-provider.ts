import {
  NoSuchModelError,
  type EmbeddingModelV4,
  type ImageModelV4,
  type LanguageModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import { OpenAICompatibleChatLanguageModel } from '@ai-sdk/openai-compatible';
import {
  loadApiKey,
  resolveWith,
  withoutTrailingSlash,
  withUserAgentSuffix,
  type FetchFunction,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import type { ApiStoreChatModelId } from './apistore-chat-options';
import { VERSION } from './version';

export interface ApiStoreProviderSettings {
  /**
   * API Store API key. Defaults to the `APISTORE_API_KEY` environment variable.
   * A function is called before each request and may return a promise.
   */
  apiKey?: Resolvable<string>;

  /**
   * Base URL for the API calls. Defaults to `https://api.apistore.cloud/v1`.
   */
  baseURL?: string;

  /**
   * Custom headers to include in the requests.
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation. You can use it as a middleware to intercept
   * requests, or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;
}

export interface ApiStoreProvider extends ProviderV4 {
  /**
   * Creates an API Store chat model for text generation.
   */
  (modelId: ApiStoreChatModelId): LanguageModelV4;

  /**
   * Creates an API Store chat model for text generation.
   */
  languageModel(modelId: ApiStoreChatModelId): LanguageModelV4;

  /**
   * Creates an API Store chat model for text generation.
   */
  chatModel(modelId: ApiStoreChatModelId): LanguageModelV4;

  /**
   * Not supported. API Store does not serve embedding models through this provider.
   */
  embeddingModel(modelId: string): EmbeddingModelV4;

  /**
   * Not supported. API Store does not serve image models through this provider.
   */
  imageModel(modelId: string): ImageModelV4;
}

export function createApiStore(
  options: ApiStoreProviderSettings = {},
): ApiStoreProvider {
  const baseURL = withoutTrailingSlash(
    options.baseURL ?? 'https://api.apistore.cloud/v1',
  );

  const getHeaders = () =>
    resolveWith(options.apiKey, apiKey =>
      withUserAgentSuffix(
        {
          Authorization: `Bearer ${loadApiKey({
            apiKey,
            environmentVariableName: 'APISTORE_API_KEY',
            description: 'API Store',
          })}`,
          ...options.headers,
        },
        `ai-sdk/apistore/${VERSION}`,
      ),
    );

  const createChatModel = (modelId: ApiStoreChatModelId) =>
    new OpenAICompatibleChatLanguageModel(modelId, {
      provider: 'apistore.chat',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      includeUsage: true,
      supportsStructuredOutputs: true,
    });

  const provider = (modelId: ApiStoreChatModelId) => createChatModel(modelId);

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createChatModel;
  provider.chatModel = createChatModel;
  provider.embeddingModel = (modelId: string): EmbeddingModelV4 => {
    throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' });
  };
  provider.imageModel = (modelId: string): ImageModelV4 => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  return provider;
}

/**
 * Default API Store provider instance. Reads the API key from `APISTORE_API_KEY`.
 */
export const apistore = createApiStore();
