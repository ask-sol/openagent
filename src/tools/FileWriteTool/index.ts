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

      const lines = content.split("\n").length;
      const preview = content.split("\n").slice(0, 8).map((l) => `  ${l}`).join("\n");
      const truncNote = lines > 8 ? `\n  ... ${lines - 8} more lines` : "";
      return {
        output: `${existed ? "Overwrote" : "Created"} ${filePath} (${lines} lines)\n${preview}${truncNote}`,
      };
    } catch (err: any) {
      return { output: "", error: `Failed to write file: ${err.message}` };
    }
  },
};
