import { exec } from "node:child_process";
import { resolve, isAbsolute } from "node:path";
import type { Tool, ToolResult, ToolContext } from "../types.js";

export const grepTool: Tool = {
  name: "Grep",
  description:
    "Search file contents using regex patterns. Returns matching lines with file paths and line numbers.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Regex pattern to search for",
      },
      path: {
        type: "string",
        description: "File or directory to search in (defaults to cwd)",
      },
      glob: {
        type: "string",
        description: 'File pattern filter (e.g. "*.ts", "*.{js,jsx}")',
      },
      context: {
        type: "number",
        description: "Lines of context around matches",
      },
      case_insensitive: {
        type: "boolean",
        description: "Case insensitive search",
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

    const args: string[] = ["--color=never", "-rn"];

    if (input.case_insensitive) args.push("-i");
    if (input.context) args.push(`-C${input.context}`);
    if (input.glob) args.push(`--include=${input.glob}`);

    args.push("--exclude-dir=node_modules");
    args.push("--exclude-dir=.git");
    args.push("--exclude-dir=dist");

    const hasRg = await new Promise<boolean>((res) => {
      exec("which rg", (err) => res(!err));
    });

    let cmd: string;
    if (hasRg) {
      const rgArgs = ["-n", "--no-heading", "--color=never"];
      if (input.case_insensitive) rgArgs.push("-i");
      if (input.context) rgArgs.push(`-C${input.context}`);
      if (input.glob) rgArgs.push(`--glob=${input.glob}`);
      rgArgs.push("-g", "!node_modules", "-g", "!.git", "-g", "!dist");
      cmd = `rg ${rgArgs.join(" ")} '${pattern.replace(/'/g, "\\'")}' ${searchPath} 2>/dev/null | head -500`;
    } else {
      cmd = `grep ${args.join(" ")} -E '${pattern.replace(/'/g, "\\'")}' ${searchPath} 2>/dev/null | head -500`;
    }

    return new Promise((resolve_) => {
      exec(cmd, { cwd: context.cwd, timeout: 30000, maxBuffer: 1024 * 1024 * 5 }, (err, stdout) => {
        const output = stdout.trim();
        if (!output) {
          resolve_({ output: "No matches found." });
        } else {
          const lines = output.split("\n");
          resolve_({
            output: `Found ${lines.length} matching lines:\n${output}`,
          });
        }
      });
    });
  },
};
