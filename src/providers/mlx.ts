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

const DEFAULT_BASE = "http://localhost:8080/v1";

const config: ProviderConfig = {
  id: "mlx",
  name: "MLX (Apple Silicon)",
  description: "Run models locally via Apple MLX — native, fast, bypasses Ollama M5 issues",
  category: "local",
  apiKeyEnvVar: "MLX_HOST",
  apiKeyUrl: "https://github.com/ml-explore/mlx-lm",
  models: [
    { id: "mlx-community/gemma-4-e2b-it-4bit", name: "Gemma 4 E2B (4-bit)", contextWindow: 128000, maxOutput: 8192 },
    { id: "mlx-community/gemma-4-e4b-it-4bit", name: "Gemma 4 E4B (4-bit)", contextWindow: 128000, maxOutput: 8192 },
    { id: "mlx-community/gemma-4-26b-a4b-it-4bit", name: "Gemma 4 26B MoE (4-bit)", contextWindow: 128000, maxOutput: 8192 },
    { id: "mlx-community/gemma-4-31b-it-4bit", name: "Gemma 4 31B (4-bit)", contextWindow: 128000, maxOutput: 8192 },
    { id: "mlx-community/Llama-3.2-3B-Instruct-4bit", name: "Llama 3.2 3B (4-bit)", contextWindow: 128000, maxOutput: 8192 },
    { id: "mlx-community/Meta-Llama-3.1-8B-Instruct-4bit", name: "Llama 3.1 8B (4-bit)", contextWindow: 128000, maxOutput: 8192 },
    { id: "mlx-community/Qwen2.5-Coder-7B-Instruct-4bit", name: "Qwen 2.5 Coder 7B (4-bit)", contextWindow: 32768, maxOutput: 8192 },
    { id: "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit", name: "Qwen 2.5 Coder 32B (4-bit)", contextWindow: 32768, maxOutput: 8192 },
    { id: "mlx-community/Mistral-7B-Instruct-v0.3-4bit", name: "Mistral 7B (4-bit)", contextWindow: 32768, maxOutput: 8192 },
    { id: "mlx-community/DeepSeek-Coder-V2-Lite-Instruct-4bit", name: "DeepSeek Coder V2 Lite (4-bit)", contextWindow: 128000, maxOutput: 8192 },
  ],
  defaultModel: "mlx-community/gemma-4-e4b-it-4bit",
  supportsStreaming: true,
  supportsToolUse: false,
  supportsVision: false,
};

function normalizeOptions(options: ProviderRequestOptions): ProviderRequestOptions {
  return {
    ...options,
    baseUrl: options.baseUrl || options.apiKey || DEFAULT_BASE,
    apiKey: "mlx",
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

export const mlxProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
