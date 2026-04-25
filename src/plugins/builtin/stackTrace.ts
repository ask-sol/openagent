import { readFileSync, existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { Plugin } from "../index.js";
import type { Tool } from "../../tools/types.js";

const stackTraceTool: Tool = {
  name: "ResolveStackTrace",
  description:
    "Take a raw stack trace and resolve each frame to a code snippet from the actual files. Returns each frame with ±3 lines of context.",
  parameters: {
    type: "object",
    properties: {
      trace: { type: "string", description: "The full stack trace text" },
    },
    required: ["trace"],
  },
  async execute(input, ctx) {
    const trace = (input.trace as string) || "";
    const lineRe = /(?:at\s.*?\(|^\s*at\s|File "|in\s)([^\s:"()]+):(\d+)(?::(\d+))?/g;
    const frames: Array<{ file: string; line: number; col?: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = lineRe.exec(trace)) !== null) {
      frames.push({ file: m[1], line: parseInt(m[2], 10), col: m[3] ? parseInt(m[3], 10) : undefined });
    }
    if (frames.length === 0) return { output: "No file:line frames found in the trace." };

    const out: string[] = [];
    for (const f of frames.slice(0, 10)) {
      const path = isAbsolute(f.file) ? f.file : resolve(ctx.cwd, f.file);
      if (!existsSync(path)) {
        out.push(`✗ ${f.file}:${f.line} — not found`);
        continue;
      }
      try {
        const lines = readFileSync(path, "utf-8").split("\n");
        const start = Math.max(0, f.line - 4);
        const end = Math.min(lines.length, f.line + 3);
        out.push(`▸ ${f.file}:${f.line}${f.col ? `:${f.col}` : ""}`);
        for (let i = start; i < end; i++) {
          const marker = i + 1 === f.line ? ">" : " ";
          out.push(`  ${marker} ${String(i + 1).padStart(5)}  ${lines[i]}`);
        }
        out.push("");
      } catch (err: any) {
        out.push(`✗ ${f.file}:${f.line} — ${err.message}`);
      }
    }
    return { output: out.join("\n") };
  },
};

export const stackTracePlugin: Plugin = {
  id: "trace",
  name: "Error Tracer",
  description: "Paste a stack trace, see the actual broken code",
  category: "debugging",
  tools: [stackTraceTool],
};
