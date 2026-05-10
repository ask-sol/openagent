import fg from "fast-glob";
import { resolve, isAbsolute } from "node:path";
import { statSync } from "node:fs";
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
    const pattern = (input.pattern as string) || "";
    const searchPath = input.path
      ? isAbsolute(input.path as string)
        ? (input.path as string)
        : resolve(context.cwd, input.path as string)
      : context.cwd;

    const normalized = pattern.includes("/") ? pattern : `**/${pattern}`;

    try {
      const matches = await fg(normalized, {
        cwd: searchPath,
        ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
        onlyFiles: true,
        dot: false,
        followSymbolicLinks: false,
        suppressErrors: true,
        absolute: true,
      });

      const sorted = matches
        .map((p) => {
          try {
            return { path: p, mtime: statSync(p).mtimeMs };
          } catch {
            return { path: p, mtime: 0 };
          }
        })
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 200)
        .map((e) => e.path);

      if (sorted.length === 0) {
        return { output: "No files matched the pattern." };
      }

      return {
        output: `Found ${sorted.length} files:\n${sorted.join("\n")}`,
      };
    } catch (err: any) {
      return { output: `Glob failed: ${err.message}` };
    }
  },
};
