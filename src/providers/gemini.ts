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
  id: "gemini",
  name: "Google Gemini",
  description: "Gemini 2.5 Pro, Flash, and more",
  category: "cloud",
  apiKeyEnvVar: "GEMINI_API_KEY",
  apiKeyUrl: "https://aistudio.google.com/apikey",
  models: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", contextWindow: 1048576, maxOutput: 65536 },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", contextWindow: 1048576, maxOutput: 65536 },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", contextWindow: 1048576, maxOutput: 65536 },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1048576, maxOutput: 8192 },
  ],
  defaultModel: "gemini-2.5-flash",
  supportsStreaming: true,
  supportsToolUse: true,
  supportsVision: true,
};

function convertToGeminiMessages(messages: ProviderMessage[]) {
  const contents: any[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;

    if (msg.role === "tool") {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: msg.tool_call_id || "unknown",
              response: { result: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) },
            },
          },
        ],
      });
      continue;
    }

    if (msg.role === "assistant") {
      const parts: any[] = [];
      if (typeof msg.content === "string" && msg.content) {
        parts.push({ text: msg.content });
      }
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments),
            },
          });
        }
      }
      if (parts.length > 0) contents.push({ role: "model", parts });
      continue;
    }

    contents.push({
      role: "user",
      parts: [{ text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) }],
    });
  }

  return contents;
}

function convertToGeminiTools(tools: ProviderTool[]) {
  if (tools.length === 0) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    },
  ];
}

async function* streamRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): AsyncGenerator<StreamChunk> {
  const body: Record<string, unknown> = {
    contents: convertToGeminiMessages(messages),
    generationConfig: {
      maxOutputTokens: options.maxTokens || 8192,
    },
  };

  if (options.systemPrompt) {
    body.systemInstruction = { parts: [{ text: options.systemPrompt }] };
  }
  if (options.temperature !== undefined) {
    (body.generationConfig as any).temperature = options.temperature;
  }

  const geminiTools = convertToGeminiTools(tools);
  if (geminiTools) body.tools = geminiTools;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:streamGenerateContent?alt=sse&key=${options.apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    yield { type: "error", error: `Gemini API error ${response.status}: ${err}` };
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
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const data = JSON.parse(trimmed.slice(6));
        const candidate = data.candidates?.[0];
        if (!candidate?.content?.parts) continue;

        for (const part of candidate.content.parts) {
          if (part.text) {
            yield { type: "text", text: part.text };
          }
          if (part.functionCall) {
            const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            yield {
              type: "tool_call_start",
              toolCall: { id, name: part.functionCall.name, arguments: "" },
            };
            yield {
              type: "tool_call_end",
              toolCall: {
                id,
                name: part.functionCall.name,
                arguments: JSON.stringify(part.functionCall.args || {}),
              },
            };
          }
        }

        if (data.usageMetadata) {
          yield {
            type: "done",
            usage: {
              inputTokens: data.usageMetadata.promptTokenCount || 0,
              outputTokens: data.usageMetadata.candidatesTokenCount || 0,
              cacheReadTokens: data.usageMetadata.cachedContentTokenCount || 0,
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
    contents: convertToGeminiMessages(messages),
    generationConfig: { maxOutputTokens: options.maxTokens || 8192 },
  };

  if (options.systemPrompt) {
    body.systemInstruction = { parts: [{ text: options.systemPrompt }] };
  }

  const geminiTools = convertToGeminiTools(tools);
  if (geminiTools) body.tools = geminiTools;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${options.apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json() as Record<string, any>;
  const candidate = data.candidates?.[0];
  const toolCalls: ProviderToolCall[] = [];
  let text = "";

  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.text) text += part.text;
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: "function",
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {}),
          },
        });
      }
    }
  }

  return {
    content: text,
    toolCalls,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount || 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    },
    stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
  };
}

async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    return res.ok;
  } catch {
    return false;
  }
}

export const geminiProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
