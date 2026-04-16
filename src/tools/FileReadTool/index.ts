import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import type { Tool, ToolResult, ToolContext } from "../types.js";

export const fileReadTool: Tool = {
  name: "FileRead",
  description:
    "Read a file from the filesystem. Returns file contents with line numbers. Can read specific line ranges for large files.",
  parameters: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Absolute or relative path to the file",
      },
      offset: {
        type: "number",
        description: "Line number to start reading from (0-based)",
      },
      limit: {
        type: "number",
        description: "Number of lines to read (default 2000)",
      },
    },
    required: ["file_path"],
  },

  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const filePath = isAbsolute(input.file_path as string)
      ? (input.file_path as string)
      : resolve(context.cwd, input.file_path as string);

    if (!existsSync(filePath)) {
      return { output: "", error: `File not found: ${filePath}` };
    }

    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      return { output: "", error: `Path is a directory, not a file: ${filePath}` };
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const offset = (input.offset as number) || 0;
      const limit = (input.limit as number) || 2000;
      const slice = lines.slice(offset, offset + limit);

      const numbered = slice
        .map((line, i) => `${offset + i + 1}\t${line}`)
        .join("\n");

      const totalLines = lines.length;
      let header = `File: ${filePath} (${totalLines} lines)`;
      if (offset > 0 || offset + limit < totalLines) {
        header += ` — showing lines ${offset + 1}-${Math.min(offset + limit, totalLines)}`;
      }

      return { output: `${header}\n${numbered}` };
    } catch (err: any) {
      return { output: "", error: `Failed to read file: ${err.message}` };
    }
  },
};
