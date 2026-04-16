import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import type { Tool, ToolResult, ToolContext } from "../types.js";

export const fileEditTool: Tool = {
  name: "FileEdit",
  description:
    "Edit a file by replacing an exact string match with new content. The old_string must be unique in the file. Use replace_all to replace every occurrence.",
  parameters: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Absolute or relative path to the file",
      },
      old_string: {
        type: "string",
        description: "The exact text to find and replace",
      },
      new_string: {
        type: "string",
        description: "The replacement text",
      },
      replace_all: {
        type: "boolean",
        description: "Replace all occurrences (default false)",
      },
    },
    required: ["file_path", "old_string", "new_string"],
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

    const oldStr = input.old_string as string;
    const newStr = input.new_string as string;
    const replaceAll = (input.replace_all as boolean) || false;

    try {
      let content = readFileSync(filePath, "utf-8");

      if (!content.includes(oldStr)) {
        return {
          output: "",
          error: `old_string not found in ${filePath}. Make sure it matches exactly including whitespace and indentation.`,
        };
      }

      if (!replaceAll) {
        const firstIdx = content.indexOf(oldStr);
        const lastIdx = content.lastIndexOf(oldStr);
        if (firstIdx !== lastIdx) {
          return {
            output: "",
            error: `old_string appears multiple times in ${filePath}. Provide more context to make it unique, or set replace_all to true.`,
          };
        }
      }

      if (replaceAll) {
        content = content.split(oldStr).join(newStr);
      } else {
        content = content.replace(oldStr, newStr);
      }

      writeFileSync(filePath, content);

      const oldLines = oldStr.split("\n");
      const newLines = newStr.split("\n");
      const added = newLines.length;
      const removed = oldLines.length;

      let diffDisplay = `Edited ${filePath} — ${added} lines added, ${removed} lines removed\n`;

      const maxDiffLines = 20;
      const diffLines: string[] = [];
      for (let i = 0; i < Math.min(removed, maxDiffLines); i++) {
        diffLines.push(`- ${oldLines[i]}`);
      }
      if (removed > maxDiffLines) diffLines.push(`  ... ${removed - maxDiffLines} more removed`);
      for (let i = 0; i < Math.min(added, maxDiffLines); i++) {
        diffLines.push(`+ ${newLines[i]}`);
      }
      if (added > maxDiffLines) diffLines.push(`  ... ${added - maxDiffLines} more added`);

      diffDisplay += diffLines.join("\n");

      return { output: diffDisplay };
    } catch (err: any) {
      return { output: "", error: `Failed to edit file: ${err.message}` };
    }
  },
};
