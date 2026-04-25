import type {
  Provider,
  ProviderConfig,
  ProviderMessage,
  ProviderTool,
  ProviderRequestOptions,
  ProviderResponse,
  StreamChunk,
} from "./types.js";
import { readFileSync, existsSync } from "node:fs";
import { todoWriteTool } from "../tools/TodoWriteTool/index.js";

function pad(n: number, width = 5): string {
  return String(n).padStart(width, " ");
}

function lineNumberOf(content: string, charIdx: number): number {
  if (charIdx < 0) return 1;
  let line = 1;
  for (let i = 0; i < charIdx; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function buildEditOutput(filePath: string, oldStr: string, newStr: string): string {
  if (!existsSync(filePath)) {
    return `Updated ${filePath}\nEdit applied (preview unavailable)\n---`;
  }
  const newContent = readFileSync(filePath, "utf-8");
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const oldLineCount = oldLines.length;
  const newLineCount = newLines.length;
  const newFileLines = newContent.split("\n");
  const startLineNew = lineNumberOf(newContent, newContent.indexOf(newStr));
  const startLineOld = startLineNew;
  const CONTEXT = 3;
  const beforeStart = Math.max(1, startLineNew - CONTEXT);
  const beforeEnd = startLineNew - 1;
  const afterStart = startLineNew + newLineCount;
  const afterEnd = Math.min(newFileLines.length, afterStart + CONTEXT - 1);

  const summary =
    oldLineCount === newLineCount
      ? `Edited ${oldLineCount} line${oldLineCount === 1 ? "" : "s"}`
      : oldLineCount > newLineCount
        ? `Removed ${oldLineCount - newLineCount} line${oldLineCount - newLineCount === 1 ? "" : "s"}`
        : `Added ${newLineCount - oldLineCount} line${newLineCount - oldLineCount === 1 ? "" : "s"}`;

  const out: string[] = [];
  out.push(`Updated ${filePath}`);
  out.push(summary);
  out.push("---");
  for (let i = beforeStart; i <= beforeEnd; i++) {
    out.push(`${pad(i)}    ${newFileLines[i - 1] ?? ""}`);
  }
  for (let i = 0; i < oldLineCount; i++) {
    out.push(`${pad(startLineOld + i)} -  ${oldLines[i]}`);
  }
  for (let i = 0; i < newLineCount; i++) {
    out.push(`${pad(startLineNew + i)} +  ${newLines[i]}`);
  }
  for (let i = afterStart; i <= afterEnd; i++) {
    out.push(`${pad(i)}    ${newFileLines[i - 1] ?? ""}`);
  }
  return out.join("\n");
}

function buildWriteOutput(filePath: string, content: string, existed: boolean): string {
  const allLines = content.split("\n");
  const total = allLines.length;
  const previewMax = 18;
  const out: string[] = [];
  out.push(`${existed ? "Overwrote" : "Created"} ${filePath}`);
  out.push(`Added ${total} line${total === 1 ? "" : "s"}`);
  out.push("---");
  for (let i = 0; i < Math.min(total, previewMax); i++) {
    out.push(`${pad(i + 1)} +  ${allLines[i]}`);
  }
  if (total > previewMax) {
    out.push(`      …  +${total - previewMax} more line${total - previewMax === 1 ? "" : "s"}`);
  }
  return out.join("\n");
}

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
            const claudeName: string = block.name || "unknown";
            const id = block.id || `call_${toolCount}_${Date.now()}`;
            const filePath = input.file_path || input.path || "";

            // Normalize Claude CLI tool names to OpenAgent's canonical names
            const nameMap: Record<string, string> = {
              Edit: "FileEdit",
              Write: "FileWrite",
              Read: "FileRead",
            };
            const oaName = nameMap[claudeName] || claudeName;

            // TodoWrite: route into our local todo store and suppress visible output
            if (claudeName === "TodoWrite") {
              try {
                await todoWriteTool.execute(input, { cwd: process.cwd() });
              } catch {}
              continue;
            }

            // Build a structured result string the REPL renderer can parse
            let constructedResult = "";
            try {
              if (claudeName === "Edit") {
                constructedResult = buildEditOutput(
                  filePath,
                  input.old_string || input.old_str || "",
                  input.new_string || input.new_str || "",
                );
              } else if (claudeName === "Write") {
                constructedResult = buildWriteOutput(
                  filePath,
                  input.content || "",
                  existsSync(filePath),
                );
              }
            } catch {}

            yield {
              type: "tool_executed",
              toolCall: {
                id,
                name: oaName,
                arguments: JSON.stringify(input),
              },
              toolResult: constructedResult || `Ran ${oaName}`,
            };
          }
        }

        const usage = event.message?.usage;
        if (usage) {
          totalInputTokens += usage.input_tokens || 0;
          totalOutputTokens += usage.output_tokens || 0;
        }
      }

      if (event.type === "user") {
        // Suppress tool_result echoes — REPL renders structured tool output
        // via onToolEnd / DiffView. Echoing the raw API result text only
        // duplicates the rendered tool block and leaks system-y text into chat.
        const content = event.message?.content || [];
        for (const _block of (Array.isArray(content) ? content : [])) {
          // intentionally empty
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
