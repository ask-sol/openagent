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
  id: "ollama",
  name: "Ollama (Local)",
  description: "Run models locally — Llama, Mistral, CodeLlama, Qwen",
  apiKeyEnvVar: "OLLAMA_HOST",
  apiKeyUrl: "https://ollama.com/download",
  models: [
    { id: "llama3.3:70b", name: "Llama 3.3 70B", contextWindow: 128000, maxOutput: 8192 },
    { id: "llama3.2:latest", name: "Llama 3.2", contextWindow: 128000, maxOutput: 8192 },
    { id: "qwen2.5-coder:32b", name: "Qwen 2.5 Coder 32B", contextWindow: 32768, maxOutput: 8192 },
    { id: "codellama:34b", name: "CodeLlama 34B", contextWindow: 16384, maxOutput: 8192 },
    { id: "deepseek-coder-v2:latest", name: "DeepSeek Coder V2", contextWindow: 128000, maxOutput: 8192 },
    { id: "mistral:latest", name: "Mistral 7B", contextWindow: 32768, maxOutput: 8192 },
  ],
  defaultModel: "llama3.2:latest",
  supportsStreaming: true,
  supportsToolUse: true,
  supportsVision: false,
};

function getBaseUrl(options: ProviderRequestOptions): string {
  return options.baseUrl || options.apiKey || "http://localhost:11434";
}

async function* streamRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): AsyncGenerator<StreamChunk> {
  const baseUrl = getBaseUrl(options);
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.systemPrompt
      ? [{ role: "system", content: options.systemPrompt }, ...messages]
      : messages,
    stream: true,
  };

  if (tools.length > 0) body.tools = tools;
  if (options.temperature !== undefined) {
    body.options = { temperature: options.temperature };
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    yield { type: "error", error: `Ollama error ${response.status}: ${err}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);

        if (data.message?.content) {
          yield { type: "text", text: data.message.content };
        }

        if (data.message?.tool_calls) {
          for (const tc of data.message.tool_calls) {
            const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            yield {
              type: "tool_call_start",
              toolCall: { id, name: tc.function.name, arguments: "" },
            };
            yield {
              type: "tool_call_end",
              toolCall: {
                id,
                name: tc.function.name,
                arguments: JSON.stringify(tc.function.arguments),
              },
            };
          }
        }

        if (data.done) {
          yield {
            type: "done",
            usage: {
              inputTokens: data.prompt_eval_count || 0,
              outputTokens: data.eval_count || 0,
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
  const baseUrl = getBaseUrl(options);
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.systemPrompt
      ? [{ role: "system", content: options.systemPrompt }, ...messages]
      : messages,
    stream: false,
  };

  if (tools.length > 0) body.tools = tools;

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error ${response.status}: ${err}`);
  }

  const data = await response.json() as Record<string, any>;
  const toolCalls: ProviderToolCall[] = (data.message?.tool_calls || []).map(
    (tc: any) => ({
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: JSON.stringify(tc.function.arguments),
      },
    })
  );

  return {
    content: data.message?.content || "",
    toolCalls,
    usage: {
      inputTokens: data.prompt_eval_count || 0,
      outputTokens: data.eval_count || 0,
    },
    stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
  };
}

async function validateApiKey(host: string): Promise<boolean> {
  try {
    const baseUrl = host || "http://localhost:11434";
    const res = await fetch(`${baseUrl}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

export const ollamaProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
