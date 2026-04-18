import type { TokenUsage } from "../providers/types.js";

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "o3": { input: 10.0, output: 40.0 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "o4-mini": { input: 1.1, output: 4.4 },
  "claude-opus-4-20250514": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "mistral-large-latest": { input: 2.0, output: 6.0 },
  "codestral-latest": { input: 0.3, output: 0.9 },
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
  "grok-3": { input: 3.0, output: 15.0 },
  "grok-3-mini": { input: 0.3, output: 0.5 },
  "openai/gpt-4.1": { input: 2.0, output: 8.0 },
  "openai/gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "openai/gpt-4o": { input: 2.5, output: 10.0 },
  "anthropic/claude-opus-4": { input: 15.0, output: 75.0 },
  "anthropic/claude-sonnet-4": { input: 3.0, output: 15.0 },
  "google/gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "google/gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "deepseek/deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek/deepseek-r1": { input: 0.55, output: 2.19 },
  "claude-opus-4-7": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 0.8, output: 4.0 },
};

export function estimateCost(model: string, usage: TokenUsage): { cost: number; formatted: string } {
  const rates = COST_PER_1M[model];
  if (!rates) {
    return { cost: 0, formatted: "N/A" };
  }

  const inputCost = (usage.inputTokens / 1_000_000) * rates.input;
  const outputCost = (usage.outputTokens / 1_000_000) * rates.output;
  const total = inputCost + outputCost;

  if (total < 0.001) {
    return { cost: total, formatted: `<$0.001` };
  }

  return { cost: total, formatted: `$${total.toFixed(4)}` };
}
