export interface ProviderMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ProviderContentBlock[];
  tool_call_id?: string;
  tool_calls?: ProviderToolCall[];
}

export interface ProviderContentBlock {
  type: "text" | "tool_use" | "tool_result" | "image_url";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  image_url?: { url: string };
}

export interface ProviderToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ProviderTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface StreamChunk {
  type: "text" | "tool_call_start" | "tool_call_delta" | "tool_call_end" | "done" | "error";
  text?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  error?: string;
  usage?: TokenUsage;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface ProviderResponse {
  content: string;
  toolCalls: ProviderToolCall[];
  usage: TokenUsage;
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "error";
}

export interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  apiKeyEnvVar: string;
  apiKeyUrl: string;
  models: ProviderModel[];
  defaultModel: string;
  supportsStreaming: boolean;
  supportsToolUse: boolean;
  supportsVision: boolean;
}

export interface ProviderModel {
  id: string;
  name: string;
  contextWindow: number;
  maxOutput: number;
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

export interface Provider {
  config: ProviderConfig;
  validateApiKey(apiKey: string): Promise<boolean>;
  stream(
    messages: ProviderMessage[],
    tools: ProviderTool[],
    options: ProviderRequestOptions
  ): AsyncGenerator<StreamChunk>;
  complete(
    messages: ProviderMessage[],
    tools: ProviderTool[],
    options: ProviderRequestOptions
  ): Promise<ProviderResponse>;
}

export interface ProviderRequestOptions {
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  systemPrompt?: string;
}
