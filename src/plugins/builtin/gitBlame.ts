import { exec } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import type { Plugin } from "../index.js";
import type { Tool } from "../../tools/types.js";

const gitBlameTool: Tool = {
  name: "GitBlame",
  description:
    "Get git blame for a range of lines and the commit messages of the relevant commits. Use to find why code looks the way it does.",
  parameters: {
    type: "object",
    properties: {
      file_path: { type: "string", description: "Path to file" },
      start_line: { type: "number", description: "First line (1-indexed)" },
      end_line: { type: "number", description: "Last line (1-indexed, inclusive)" },
    },
    required: ["file_path", "start_line", "end_line"],
  },
  async execute(input, ctx) {
    const filePath = isAbsolute(input.file_path as string)
      ? (input.file_path as string)
      : resolve(ctx.cwd, input.file_path as string);
    const start = input.start_line as number;
    const end = input.end_line as number;
    const cmd = `git blame -L ${start},${end} --porcelain "${filePath}"`;
    return new Promise((resolve) => {
      exec(cmd, { cwd: ctx.cwd, timeout: 15000 }, (err, stdout, stderr) => {
        if (err) return resolve({ output: "", error: stderr.trim() || err.message });
        const shas = new Set<string>();
        for (const line of stdout.split("\n")) {
          const m = line.match(/^([0-9a-f]{40})\s/);
          if (m) shas.add(m[1]);
        }
        const summaryLines: string[] = ["Blame:", stdout.split("\n").slice(0, 20).join("\n"), ""];
        if (shas.size === 0) return resolve({ output: summaryLines.join("\n") });
        const shaList = Array.from(shas).slice(0, 5);
        const logCmd = `git show --no-patch --pretty=format:'%h %an, %ar — %s' ${shaList.join(" ")}`;
        exec(logCmd, { cwd: ctx.cwd, timeout: 10000 }, (e2, out2) => {
          summaryLines.push("Commits:");
          summaryLines.push(e2 ? "(could not resolve)" : out2.trim());
          resolve({ output: summaryLines.join("\n") });
        });
      });
    });
  },
};

export const gitBlamePlugin: Plugin = {
  id: "git-blame",
  name: "Git Blame Explainer",
  description: "Shows blame for line ranges plus the commit messages behind them",
  category: "git",
  tools: [gitBlameTool],
};
