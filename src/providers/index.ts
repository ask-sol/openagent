import { openaiProvider } from "./openai.js";
import { anthropicProvider } from "./anthropic.js";
import { geminiProvider } from "./gemini.js";
import { mistralProvider } from "./mistral.js";
import { groqProvider } from "./groq.js";
import { ollamaProvider } from "./ollama.js";
import { lmstudioProvider } from "./lmstudio.js";
import { mlxProvider } from "./mlx.js";
import { deepseekProvider } from "./deepseek.js";
import { xaiProvider } from "./xai.js";
import { openrouterProvider } from "./openrouter.js";
import { bedrockProvider } from "./bedrock.js";
import { alibabaProvider } from "./alibaba.js";
import { anthropicMaxProvider } from "./anthropicMax.js";
import type { Provider, ProviderConfig } from "./types.js";

export const providers: Map<string, Provider> = new Map([
  ["openrouter", openrouterProvider],
  ["openai", openaiProvider],
  ["anthropic", anthropicProvider],
  ["anthropic-max", anthropicMaxProvider],
  ["gemini", geminiProvider],
  ["alibaba", alibabaProvider],
  ["mistral", mistralProvider],
  ["groq", groqProvider],
  ["deepseek", deepseekProvider],
  ["xai", xaiProvider],
  ["bedrock", bedrockProvider],
  ["ollama", ollamaProvider],
  ["lmstudio", lmstudioProvider],
  ["mlx", mlxProvider],
]);

export function getProvider(id: string): Provider | undefined {
  return providers.get(id);
}

export function getAllProviders(): Provider[] {
  return Array.from(providers.values());
}

export function searchProviders(query: string): Provider[] {
  const q = query.toLowerCase();
  return getAllProviders().filter(
    (p) =>
      p.config.id.includes(q) ||
      p.config.name.toLowerCase().includes(q) ||
      p.config.description.toLowerCase().includes(q) ||
      p.config.models.some(
        (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
      )
  );
}

export function searchModels(query: string): Array<{ provider: ProviderConfig; model: { id: string; name: string } }> {
  const q = query.toLowerCase();
  const results: Array<{ provider: ProviderConfig; model: { id: string; name: string } }> = [];

  for (const provider of getAllProviders()) {
    for (const model of provider.config.models) {
      if (
        model.id.toLowerCase().includes(q) ||
        model.name.toLowerCase().includes(q) ||
        provider.config.name.toLowerCase().includes(q)
      ) {
        results.push({ provider: provider.config, model });
      }
    }
  }

  return results;
}

export type { Provider, ProviderConfig } from "./types.js";
export type {
  ProviderMessage,
  ProviderTool,
  ProviderRequestOptions,
  ProviderResponse,
  StreamChunk,
  TokenUsage,
  ProviderToolCall,
} from "./types.js";
