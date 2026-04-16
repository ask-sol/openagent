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
import { createHmac, createHash } from "node:crypto";

const config: ProviderConfig = {
  id: "bedrock",
  name: "AWS Bedrock",
  description: "Claude, Llama, Mistral on AWS — use IAM credentials",
  category: "cloud",
  apiKeyEnvVar: "AWS_ACCESS_KEY_ID",
  apiKeyUrl: "https://console.aws.amazon.com/iam/",
  models: [
    { id: "anthropic.claude-sonnet-4-20250514-v1:0", name: "Claude Sonnet 4", contextWindow: 200000, maxOutput: 16000 },
    { id: "anthropic.claude-3-5-haiku-20241022-v1:0", name: "Claude 3.5 Haiku", contextWindow: 200000, maxOutput: 8192 },
    { id: "meta.llama3-3-70b-instruct-v1:0", name: "Llama 3.3 70B", contextWindow: 128000, maxOutput: 8192 },
    { id: "mistral.mistral-large-2411-v1:0", name: "Mistral Large", contextWindow: 128000, maxOutput: 8192 },
    { id: "amazon.nova-pro-v1:0", name: "Amazon Nova Pro", contextWindow: 300000, maxOutput: 5120 },
    { id: "amazon.nova-lite-v1:0", name: "Amazon Nova Lite", contextWindow: 300000, maxOutput: 5120 },
  ],
  defaultModel: "anthropic.claude-sonnet-4-20250514-v1:0",
  supportsStreaming: true,
  supportsToolUse: true,
  supportsVision: false,
};

function getAwsCredentials(): { accessKey: string; secretKey: string; region: string } {
  return {
    accessKey: process.env.AWS_ACCESS_KEY_ID || "",
    secretKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    region: process.env.AWS_REGION || "us-east-1",
  };
}

function signV4(method: string, url: string, headers: Record<string, string>, body: string, creds: { accessKey: string; secretKey: string; region: string }) {
  const u = new URL(url);
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateShort = date.slice(0, 8);
  const service = "bedrock";
  const scope = `${dateShort}/${creds.region}/${service}/aws4_request`;

  headers["x-amz-date"] = date;
  headers["host"] = u.host;

  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join("");
  const payloadHash = createHash("sha256").update(body).digest("hex");

  const canonicalRequest = [method, u.pathname, u.search.slice(1), canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", date, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");

  const kDate = createHmac("sha256", `AWS4${creds.secretKey}`).update(dateShort).digest();
  const kRegion = createHmac("sha256", kDate).update(creds.region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  headers["authorization"] = `AWS4-HMAC-SHA256 Credential=${creds.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return headers;
}

async function* streamRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): AsyncGenerator<StreamChunk> {
  const creds = getAwsCredentials();
  if (!creds.accessKey || !creds.secretKey) {
    yield { type: "error", error: "AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables." };
    return;
  }

  const isAnthropic = options.model.startsWith("anthropic.");
  const region = creds.region;

  if (isAnthropic) {
    const body: Record<string, unknown> = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: options.maxTokens || 8192,
      messages: messages.filter(m => m.role !== "system").map(m => ({
        role: m.role === "tool" ? "user" : m.role,
        content: typeof m.content === "string" ? m.content : m.content,
      })),
    };

    if (options.systemPrompt) body.system = options.systemPrompt;

    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${options.model}/invoke`;
    const bodyStr = JSON.stringify(body);
    const headers: Record<string, string> = { "content-type": "application/json" };
    signV4("POST", url, headers, bodyStr, creds);

    const response = await fetch(url, { method: "POST", headers, body: bodyStr });

    if (!response.ok) {
      const err = await response.text();
      yield { type: "error", error: `Bedrock API error ${response.status}: ${err}` };
      return;
    }

    const data = await response.json() as Record<string, any>;
    let text = "";
    for (const block of (data.content || [])) {
      if (block.type === "text") text += block.text;
    }

    yield { type: "text", text };
    yield {
      type: "done",
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
    };
  } else {
    const body: Record<string, unknown> = {
      messages: options.systemPrompt
        ? [{ role: "system", content: [{ text: options.systemPrompt }] }, ...messages.map(m => ({ role: m.role, content: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }] }))]
        : messages.map(m => ({ role: m.role === "tool" ? "user" : m.role, content: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }] })),
      inferenceConfig: { maxTokens: options.maxTokens || 8192 },
    };

    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${options.model}/converse`;
    const bodyStr = JSON.stringify(body);
    const headers: Record<string, string> = { "content-type": "application/json" };
    signV4("POST", url, headers, bodyStr, creds);

    const response = await fetch(url, { method: "POST", headers, body: bodyStr });

    if (!response.ok) {
      const err = await response.text();
      yield { type: "error", error: `Bedrock API error ${response.status}: ${err}` };
      return;
    }

    const data = await response.json() as Record<string, any>;
    const output = data.output?.message?.content || [];
    let text = "";
    for (const block of output) {
      if (block.text) text += block.text;
    }

    yield { type: "text", text };
    yield {
      type: "done",
      usage: {
        inputTokens: data.usage?.inputTokens || 0,
        outputTokens: data.usage?.outputTokens || 0,
      },
    };
  }
}

async function completeRequest(
  messages: ProviderMessage[],
  tools: ProviderTool[],
  options: ProviderRequestOptions
): Promise<ProviderResponse> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of streamRequest(messages, tools, options)) {
    chunks.push(chunk);
  }

  let text = "";
  let usage = { inputTokens: 0, outputTokens: 0 };
  for (const c of chunks) {
    if (c.type === "text") text += c.text || "";
    if (c.type === "done" && c.usage) usage = c.usage;
    if (c.type === "error") throw new Error(c.error);
  }

  return { content: text, toolCalls: [], usage, stopReason: "end_turn" };
}

async function validateApiKey(key: string): Promise<boolean> {
  return !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
}

export const bedrockProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
