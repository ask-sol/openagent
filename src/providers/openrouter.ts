import type {
  Provider,
  ProviderConfig,
  ProviderMessage,
  ProviderTool,
  ProviderRequestOptions,
  ProviderResponse,
  StreamChunk,
  ProviderToolCall,
} from "./types.js";

const config: ProviderConfig = {
  id: "openrouter",
  name: "OpenRouter",
  description: "One key, hundreds of models — GPT, Claude, Gemini, Llama, Mistral, and more",
  category: "cloud",
  apiKeyEnvVar: "OPENROUTER_API_KEY",
  apiKeyUrl: "https://openrouter.ai/keys",
  models: [
    { id: "openai/gpt-4.1", name: "GPT-4.1", contextWindow: 1048576, maxOutput: 32768 },
    { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", contextWindow: 1048576, maxOutput: 32768 },
    { id: "openai/gpt-4o", name: "GPT-4o", contextWindow: 128000, maxOutput: 16384 },
    { id: "openai/o3", name: "o3", contextWindow: 200000, maxOutput: 100000 },
    { id: "openai/o4-mini", name: "o4 Mini", contextWindow: 200000, maxOutput: 100000 },
    { id: "anthropic/claude-opus-4", name: "Claude Opus 4", contextWindow: 200000, maxOutput: 32000 },
    { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", contextWindow: 200000, maxOutput: 16000 },
    { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", contextWindow: 200000, maxOutput: 8192 },
    { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", contextWindow: 1048576, maxOutput: 65536 },
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", contextWindow: 1048576, maxOutput: 65536 },
    { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", contextWindow: 128000, maxOutput: 8192 },
    { id: "mistralai/mistral-large", name: "Mistral Large", contextWindow: 128000, maxOutput: 8192 },
    { id: "mistralai/codestral", name: "Codestral", contextWindow: 256000, maxOutput: 8192 },
    { id: "deepseek/deepseek-chat", name: "DeepSeek V3", contextWindow: 65536, maxOutput: 8192 },
    { id: "deepseek/deepseek-r1", name: "DeepSeek R1", contextWindow: 65536, maxOutput: 8192 },
    { id: "x-ai/grok-3", name: "Grok 3", contextWindow: 131072, maxOutput: 16384 },
    { id: "qwen/qwen-2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B", contextWindow: 32768, maxOutput: 8192 },
    { id: "nousresearch/hermes-3-llama-3.1-405b", name: "Hermes 3 405B", contextWindow: 128000, maxOutput: 8192 },
    { id: "cohere/command-r-plus", name: "Command R+", contextWindow: 128000, maxOutput: 4096 },
    { id: "perplexity/sonar-pro", name: "Sonar Pro", contextWindow: 200000, maxOutput: 8192 },
  ],
  defaultModel: "openai/gpt-4.1-mini",
  supportsStreaming: true,
  supportsToolUse: true,
  supportsVision: true,
};

async function* streamRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): AsyncGenerator<StreamChunk> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.systemPrompt
      ? [{ role: "system", content: options.systemPrompt }, ...messages]
      : messages,
    stream: true,
  };

  if (tools.length > 0) body.tools = tools;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens) body.max_tokens = options.maxTokens;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
      "HTTP-Referer": "https://github.com/openagent-cli/openagent",
      "X-Title": "OpenAgent",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    yield { type: "error", error: `OpenRouter API error ${response.status}: ${err}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";
  const toolCallBuffers: Map<number, { id: string; name: string; args: string }> = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const data = JSON.parse(trimmed.slice(6));
        const choice = data.choices?.[0];
        if (!choice) {
          if (data.usage) {
            yield {
              type: "done",
              usage: {
                inputTokens: data.usage.prompt_tokens || 0,
                outputTokens: data.usage.completion_tokens || 0,
                cacheReadTokens: data.usage.prompt_tokens_details?.cached_tokens || 0,
              },
            };
          }
          continue;
        }

        const delta = choice.delta;
        if (delta?.content) {
          yield { type: "text", text: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (tc.id) {
              toolCallBuffers.set(idx, { id: tc.id, name: tc.function?.name || "", args: "" });
              yield {
                type: "tool_call_start",
                toolCall: { id: tc.id, name: tc.function?.name || "", arguments: "" },
              };
            }
            if (tc.function?.arguments) {
              const buf = toolCallBuffers.get(idx);
              if (buf) {
                buf.args += tc.function.arguments;
                yield {
                  type: "tool_call_delta",
                  toolCall: { id: buf.id, name: buf.name, arguments: tc.function.arguments },
                };
              }
            }
          }
        }

        if (choice.finish_reason === "tool_calls" || choice.finish_reason === "stop") {
          for (const [, buf] of toolCallBuffers) {
            yield {
              type: "tool_call_end",
              toolCall: { id: buf.id, name: buf.name, arguments: buf.args },
            };
          }
        }

        if (data.usage) {
          yield {
            type: "done",
            usage: {
              inputTokens: data.usage.prompt_tokens || 0,
              outputTokens: data.usage.completion_tokens || 0,
            },
          };
        }
      } catch {}
    }
  }
}

async function completeRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): Promise<ProviderResponse> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.systemPrompt
      ? [{ role: "system", content: options.systemPrompt }, ...messages]
      : messages,
  };

  if (tools.length > 0) body.tools = tools;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens) body.max_tokens = options.maxTokens;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
      "HTTP-Referer": "https://github.com/openagent-cli/openagent",
      "X-Title": "OpenAgent",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${err}`);
  }

  const data = await response.json() as Record<string, any>;
  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error("No response from API");
  }
  const toolCalls: ProviderToolCall[] = (choice.message.tool_calls || []).map(
    (tc: any) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    })
  );

  return {
    content: choice.message.content || "",
    toolCalls,
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    },
    stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
  };
}

async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const openrouterProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
