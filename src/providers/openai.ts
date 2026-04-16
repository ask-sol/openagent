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
  id: "openai",
  name: "OpenAI",
  description: "GPT-4o, GPT-4.1, o1, o3 and more",
  apiKeyEnvVar: "OPENAI_API_KEY",
  apiKeyUrl: "https://platform.openai.com/api-keys",
  models: [
    { id: "gpt-4.1", name: "GPT-4.1", contextWindow: 1048576, maxOutput: 32768 },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", contextWindow: 1048576, maxOutput: 32768 },
    { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", contextWindow: 1048576, maxOutput: 32768 },
    { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, maxOutput: 16384 },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128000, maxOutput: 16384 },
    { id: "o3", name: "o3", contextWindow: 200000, maxOutput: 100000 },
    { id: "o3-mini", name: "o3 Mini", contextWindow: 200000, maxOutput: 100000 },
    { id: "o4-mini", name: "o4 Mini", contextWindow: 200000, maxOutput: 100000 },
  ],
  defaultModel: "gpt-4.1",
  supportsStreaming: true,
  supportsToolUse: true,
  supportsVision: true,
};

function buildRequestBody(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
) {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.systemPrompt
      ? [{ role: "system", content: options.systemPrompt }, ...messages]
      : messages,
    stream: false,
  };

  if (tools.length > 0) body.tools = tools;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens) body.max_tokens = options.maxTokens;
  if (options.topP !== undefined) body.top_p = options.topP;

  return body;
}

async function* streamRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): AsyncGenerator<StreamChunk> {
  const body = buildRequestBody(messages, tools, options);
  body.stream = true;
  body.stream_options = { include_usage: true };

  const baseUrl = options.baseUrl || "https://api.openai.com/v1";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    yield { type: "error", error: `OpenAI API error ${response.status}: ${err}` };
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
      } catch {}
    }
  }
}

async function completeRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): Promise<ProviderResponse> {
  const body = buildRequestBody(messages, tools, options);
  const baseUrl = options.baseUrl || "https://api.openai.com/v1";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json() as Record<string, any>;
  const choice = data.choices[0];
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
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const openaiProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
