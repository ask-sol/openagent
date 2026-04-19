import { openaiProvider } from "./openai.js";
import type {
  Provider,
  ProviderConfig,
  ProviderMessage,
  ProviderTool,
  ProviderRequestOptions,
  ProviderResponse,
  StreamChunk,
} from "./types.js";

const DEFAULT_BASE = "http://localhost:1234/v1";

const config: ProviderConfig = {
  id: "lmstudio",
  name: "LM Studio (Local)",
  description: "Run models locally via LM Studio — GGUF models, OpenAI-compatible",
  category: "local",
  apiKeyEnvVar: "LMSTUDIO_HOST",
  apiKeyUrl: "https://lmstudio.ai/download",
  models: [
    { id: "lmstudio-community/Llama-3.2-3B-Instruct-GGUF", name: "Llama 3.2 3B", contextWindow: 128000, maxOutput: 8192 },
    { id: "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF", name: "Llama 3.1 8B", contextWindow: 128000, maxOutput: 8192 },
    { id: "lmstudio-community/Qwen2.5-Coder-7B-Instruct-GGUF", name: "Qwen 2.5 Coder 7B", contextWindow: 32768, maxOutput: 8192 },
    { id: "lmstudio-community/Qwen2.5-Coder-32B-Instruct-GGUF", name: "Qwen 2.5 Coder 32B", contextWindow: 32768, maxOutput: 8192 },
    { id: "lmstudio-community/Mistral-7B-Instruct-v0.3-GGUF", name: "Mistral 7B", contextWindow: 32768, maxOutput: 8192 },
    { id: "lmstudio-community/DeepSeek-Coder-V2-Lite-Instruct-GGUF", name: "DeepSeek Coder V2 Lite", contextWindow: 128000, maxOutput: 8192 },
  ],
  defaultModel: "lmstudio-community/Llama-3.2-3B-Instruct-GGUF",
  supportsStreaming: true,
  supportsToolUse: true,
  supportsVision: false,
};

function normalizeOptions(options: ProviderRequestOptions): ProviderRequestOptions {
  return {
    ...options,
    baseUrl: options.baseUrl || options.apiKey || DEFAULT_BASE,
    apiKey: "lm-studio",
  };
}

async function* streamRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): AsyncGenerator<StreamChunk> {
  yield* openaiProvider.stream(messages, tools, normalizeOptions(options));
}

async function completeRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): Promise<ProviderResponse> {
  return openaiProvider.complete(messages, tools, normalizeOptions(options));
}

async function validateApiKey(host: string): Promise<boolean> {
  try {
    const baseUrl = host && host.startsWith("http") ? host : DEFAULT_BASE;
    const res = await fetch(`${baseUrl.replace(/\/v1$/, "")}/v1/models`);
    return res.ok;
  } catch {
    return false;
  }
}

export const lmstudioProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
