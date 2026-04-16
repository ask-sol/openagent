import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, isAbsolute, dirname } from "node:path";
import type { Tool, ToolResult, ToolContext } from "../types.js";

export const fileWriteTool: Tool = {
  name: "FileWrite",
  description:
    "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Creates parent directories as needed.",
  parameters: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Absolute or relative path to the file",
      },
      content: {
        type: "string",
        description: "The content to write",
      },
    },
    required: ["file_path", "content"],
  },

  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const filePath = isAbsolute(input.file_path as string)
      ? (input.file_path as string)
      : resolve(context.cwd, input.file_path as string);

    const content = input.content as string;

    try {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const existed = existsSync(filePath);
      writeFileSync(filePath, content);

      const allLines = content.split("\n");
      const lines = allLines.length;
      const preview = allLines.slice(0, 12).map((l) => `+ ${l}`).join("\n");
      const truncNote = lines > 12 ? `\n  ... +${lines - 12} more lines` : "";
      return {
        output: `${existed ? "Overwrote" : "Created"} ${filePath} (${lines} lines, +${lines} added)\n${preview}${truncNote}`,
      };
    } catch (err: any) {
      return { output: "", error: `Failed to write file: ${err.message}` };
    }
  },
};
