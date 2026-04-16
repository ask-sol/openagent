import { exec } from "node:child_process";
import { resolve, isAbsolute } from "node:path";
import type { Tool, ToolResult, ToolContext } from "../types.js";

export const globTool: Tool = {
  name: "Glob",
  description:
    "Find files matching a glob pattern. Returns matching file paths sorted by modification time.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: 'Glob pattern (e.g. "**/*.ts", "src/**/*.tsx")',
      },
      path: {
        type: "string",
        description: "Directory to search in (defaults to cwd)",
      },
    },
    required: ["pattern"],
  },

  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const pattern = input.pattern as string;
    const searchPath = input.path
      ? isAbsolute(input.path as string)
        ? (input.path as string)
        : resolve(context.cwd, input.path as string)
      : context.cwd;

    return new Promise((resolve_) => {
      const cmd = `find ${searchPath} -path '*/node_modules' -prune -o -path '*/.git' -prune -o -name '${pattern.replace(/\*\*\//g, "")}' -print 2>/dev/null | head -200`;

      exec(cmd, { cwd: searchPath, timeout: 30000 }, (err, stdout) => {
        if (err && !stdout) {
          try {
            const fg = require("fast-glob");
            fg.sync(pattern, {
              cwd: searchPath,
              ignore: ["node_modules/**", ".git/**"],
              absolute: true,
            }).then((files: string[]) => {
              resolve_({
                output: files.length > 0
                  ? `Found ${files.length} files:\n${files.join("\n")}`
                  : "No files matched the pattern.",
              });
            });
          } catch {
            resolve_({ output: "", error: `Glob failed: ${err?.message}` });
          }
          return;
        }

        const files = stdout
          .trim()
          .split("\n")
          .filter((f) => f.length > 0);

        resolve_({
          output: files.length > 0
            ? `Found ${files.length} files:\n${files.join("\n")}`
            : "No files matched the pattern.",
        });
      });
    });
  },
};
