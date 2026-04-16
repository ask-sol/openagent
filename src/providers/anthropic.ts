import type {
  Provider,
  ProviderConfig,
  ProviderMessage,
  ProviderTool,
  ProviderRequestOptions,
  ProviderResponse,
  StreamChunk,
  ProviderToolCall,
  ProviderContentBlock,
} from "./types.js";

const config: ProviderConfig = {
  id: "anthropic",
  name: "Anthropic",
  description: "Claude Opus 4, Sonnet 4, Haiku 3.5",
  apiKeyEnvVar: "ANTHROPIC_API_KEY",
  apiKeyUrl: "https://console.anthropic.com/settings/keys",
  models: [
    { id: "claude-opus-4-20250514", name: "Claude Opus 4", contextWindow: 200000, maxOutput: 32000 },
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", contextWindow: 200000, maxOutput: 16000 },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", contextWindow: 200000, maxOutput: 8192 },
  ],
  defaultModel: "claude-sonnet-4-20250514",
  supportsStreaming: true,
  supportsToolUse: true,
  supportsVision: true,
};

function convertMessages(messages: ProviderMessage[]): any[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "tool") {
        return {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: m.tool_call_id,
              content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
            },
          ],
        };
      }

      if (m.role === "assistant" && m.tool_calls) {
        const content: any[] = [];
        if (typeof m.content === "string" && m.content) {
          content.push({ type: "text", text: m.content });
        }
        for (const tc of m.tool_calls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
        return { role: "assistant", content };
      }

      return {
        role: m.role,
        content: typeof m.content === "string" ? m.content : m.content,
      };
    });
}

function convertTools(tools: ProviderTool[]): any[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

async function* streamRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): AsyncGenerator<StreamChunk> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: convertMessages(messages),
    max_tokens: options.maxTokens || 8192,
    stream: true,
  };

  if (options.systemPrompt) body.system = options.systemPrompt;
  if (tools.length > 0) body.tools = convertTools(tools);
  if (options.temperature !== undefined) body.temperature = options.temperature;

  const baseUrl = options.baseUrl || "https://api.anthropic.com";
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    yield { type: "error", error: `Anthropic API error ${response.status}: ${err}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";
  let currentToolId = "";
  let currentToolName = "";
  let toolArgBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const data = JSON.parse(trimmed.slice(6));

        switch (data.type) {
          case "content_block_start":
            if (data.content_block?.type === "tool_use") {
              currentToolId = data.content_block.id;
              currentToolName = data.content_block.name;
              toolArgBuffer = "";
              yield {
                type: "tool_call_start",
                toolCall: { id: currentToolId, name: currentToolName, arguments: "" },
              };
            }
            break;

          case "content_block_delta":
            if (data.delta?.type === "text_delta") {
              yield { type: "text", text: data.delta.text };
            } else if (data.delta?.type === "input_json_delta") {
              toolArgBuffer += data.delta.partial_json;
              yield {
                type: "tool_call_delta",
                toolCall: {
                  id: currentToolId,
                  name: currentToolName,
                  arguments: data.delta.partial_json,
                },
              };
            }
            break;

          case "content_block_stop":
            if (currentToolId) {
              yield {
                type: "tool_call_end",
                toolCall: {
                  id: currentToolId,
                  name: currentToolName,
                  arguments: toolArgBuffer,
                },
              };
              currentToolId = "";
              currentToolName = "";
              toolArgBuffer = "";
            }
            break;

          case "message_delta":
            if (data.usage) {
              yield {
                type: "done",
                usage: {
                  inputTokens: data.message?.usage?.input_tokens || 0,
                  outputTokens: data.usage.output_tokens || 0,
                  cacheReadTokens: data.message?.usage?.cache_read_input_tokens || 0,
                  cacheWriteTokens: data.message.usage.cache_creation_input_tokens || 0,
                },
              };
            }
            break;
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
    messages: convertMessages(messages),
    max_tokens: options.maxTokens || 8192,
  };

  if (options.systemPrompt) body.system = options.systemPrompt;
  if (tools.length > 0) body.tools = convertTools(tools);
  if (options.temperature !== undefined) body.temperature = options.temperature;

  const baseUrl = options.baseUrl || "https://api.anthropic.com";
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json() as Record<string, any>;
  const toolCalls: ProviderToolCall[] = [];
  let text = "";

  for (const block of data.content) {
    if (block.type === "text") text += block.text;
    if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: { name: block.name, arguments: JSON.stringify(block.input) },
      });
    }
  }

  return {
    content: text,
    toolCalls,
    usage: {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    },
    stopReason: data.stop_reason === "tool_use" ? "tool_use" : "end_turn",
  };
}

async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const anthropicProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
