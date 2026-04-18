import type {
  Provider,
  ProviderConfig,
  ProviderMessage,
  ProviderTool,
  ProviderRequestOptions,
  ProviderResponse,
  StreamChunk,
} from "./types.js";

const config: ProviderConfig = {
  id: "anthropic-max",
  name: "Anthropic (Max Plan)",
  description: "Use your Claude Max/Pro subscription — requires Claude Code installed",
  category: "cloud",
  apiKeyEnvVar: "",
  apiKeyUrl: "",
  models: [
    { id: "claude-opus-4-7", name: "Claude Opus 4.7", contextWindow: 1000000, maxOutput: 32000 },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", contextWindow: 200000, maxOutput: 16000 },
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", contextWindow: 200000, maxOutput: 8192 },
  ],
  defaultModel: "claude-sonnet-4-6",
  supportsStreaming: true,
  supportsToolUse: false,
  supportsVision: false,
};

function getModelAlias(model: string): string {
  if (model.includes("opus")) return "opus";
  if (model.includes("haiku")) return "haiku";
  return "sonnet";
}

function buildPrompt(messages: ProviderMessage[], systemPrompt?: string): string {
  const parts: string[] = [];
  if (systemPrompt) parts.push(systemPrompt, "");

  for (const m of messages) {
    if (m.role === "system") continue;
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    if (m.role === "user") parts.push(content);
  }

  return parts.join("\n");
}

async function* streamRequest(
  messages: ProviderMessage[],
  _tools: ProviderTool[],
  options: ProviderRequestOptions
): AsyncGenerator<StreamChunk> {
  const prompt = buildPrompt(messages, options.systemPrompt);
  const modelAlias = getModelAlias(options.model);

  const { spawn } = await import("node:child_process");

  const child = spawn("claude", [
    "-p", prompt,
    "--model", modelAlias,
    "--output-format", "stream-json",
    "--verbose",
    "--dangerously-skip-permissions",
    "--no-session-persistence",
  ], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "ignore"],
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let buffer = "";
  let toolCount = 0;
  let agentHeaderShown = false;

  const events: Array<Record<string, any>> = [];
  let resolveNext: (() => void) | null = null;
  let finished = false;

  child.stdout!.on("data", (data: Buffer) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
        if (resolveNext) { resolveNext(); resolveNext = null; }
      } catch {}
    }
  });

  child.on("close", () => {
    finished = true;
    if (resolveNext) { resolveNext(); resolveNext = null; }
  });

  while (true) {
    while (events.length === 0 && !finished) {
      await new Promise<void>((r) => { resolveNext = r; });
    }
    if (events.length === 0 && finished) break;

    const event = events.shift()!;

    try {
      if (event.type === "assistant") {
        const content = event.message?.content || [];
        for (const block of content) {
          if (block.type === "thinking" && block.thinking) {
            yield { type: "text", text: `{{think}}${block.thinking}{{/think}}\n` };
          }
          if (block.type === "text" && block.text) {
            let txt = block.text;
            txt = txt.replace(/<think>[\s\S]*?<\/think>/g, "");
            txt = txt.replace(/Links:.*?\{.*?"title".*?\}.*$/gm, "");
            txt = txt.replace(/^Links:.*$/gm, "");
            txt = txt.replace(/^\s*\n/gm, "\n");
            if (txt.trim()) yield { type: "text", text: txt };
          }
          if (block.type === "tool_use") {
            toolCount++;
            const input = block.input || {};
            const name = block.name || "unknown";
            const filePath = input.file_path || input.path || "";
            const fileName = filePath ? filePath.split("/").pop() : "";

            if (!agentHeaderShown) {
              agentHeaderShown = true;
              yield { type: "text", text: `\n● Agent\n` };
            }

            let toolLine = "";
            let detail = "";

            if (name === "Bash") {
              const cmd = input.command || input.cmd || "";
              toolLine = `Bash(${cmd.length > 70 ? cmd.slice(0, 67) + "..." : cmd})`;
            } else if (name === "Write") {
              toolLine = `Create(${fileName})`;
              const fileContent = input.content || "";
              const lines = fileContent.split("\n");
              const show = Math.min(lines.length, 12);
              for (let i = 0; i < show; i++) detail += `${String(i + 1).padStart(6)} + ${lines[i]}\n`;
              if (lines.length > 12) detail += `       ... +${lines.length - 12} more lines\n`;
            } else if (name === "Edit") {
              toolLine = `Edit(${fileName})`;
              const oldL = (input.old_string || input.old_str || "").split("\n");
              const newL = (input.new_string || input.new_str || "").split("\n");
              for (const l of oldL.slice(0, 6)) detail += `       - ${l}\n`;
              for (const l of newL.slice(0, 6)) detail += `       + ${l}\n`;
            } else if (name === "Read") {
              toolLine = `Read(${fileName})`;
            } else if (name === "WebSearch") {
              toolLine = `Web(${input.query || ""})`;
            } else if (name === "WebFetch") {
              toolLine = `Fetch(${(input.url || "").slice(0, 60)})`;
            } else if (name === "Glob") {
              toolLine = `Glob(${input.pattern || ""})`;
            } else if (name === "Grep") {
              toolLine = `Grep(${input.pattern || ""})`;
            } else if (name === "ToolSearch") {
              toolLine = `Search(${input.query || ""})`;
            } else {
              toolLine = `${name}(${JSON.stringify(input).slice(0, 50)})`;
            }

            yield { type: "text", text: `   ⎿ ${toolLine}\n` };
            if (detail) yield { type: "text", text: detail };
          }
        }

        const usage = event.message?.usage;
        if (usage) {
          totalInputTokens += usage.input_tokens || 0;
          totalOutputTokens += usage.output_tokens || 0;
        }
      }

      if (event.type === "user") {
        const content = event.message?.content || [];
        for (const block of (Array.isArray(content) ? content : [])) {
          if (block.type === "tool_result") {
            const resultText = typeof block.content === "string"
              ? block.content
              : Array.isArray(block.content)
                ? block.content.map((c: any) => c.text || "").join("")
                : JSON.stringify(block.content || "");

            if (resultText) {
              const truncated = resultText.length > 200 ? resultText.slice(0, 200) + "..." : resultText;
              const isSuccess = truncated.includes("successfully") || truncated.includes("passed") || truncated.includes("created");
              const prefix = isSuccess ? "✓" : "⎿";
              yield { type: "text", text: `${prefix} ${truncated}\n` };
            }
          }
        }
      }

      if (event.type === "result") {
        const usage = event.usage || {};
        const cost = event.total_cost_usd || 0;
        const duration = event.duration_ms || 0;
        const turns = event.num_turns || 1;
        const durationSec = (duration / 1000).toFixed(1);

        const toolInfo = toolCount > 0 ? ` • ${toolCount} tool${toolCount > 1 ? "s" : ""}` : "";
        yield { type: "text", text: `\n✓ ${durationSec}s${toolInfo} • $${cost.toFixed(4)}` };
        agentHeaderShown = false;
        toolCount = 0;

        yield {
          type: "done",
          usage: {
            inputTokens: usage.input_tokens || totalInputTokens,
            outputTokens: usage.output_tokens || totalOutputTokens,
            cacheReadTokens: usage.cache_read_input_tokens || 0,
            costUsd: cost,
          },
        };

        child.kill();
        return;
      }
    } catch {}
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

async function validateApiKey(): Promise<boolean> {
  const { exec } = await import("node:child_process");
  return new Promise((resolve) => {
    exec("claude --version", { timeout: 5000 }, (err) => resolve(!err));
  });
}

export const anthropicMaxProvider: Provider = {
  config,
  validateApiKey,
  stream: streamRequest,
  complete: completeRequest,
};
