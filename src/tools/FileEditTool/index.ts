import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import type { Tool, ToolResult, ToolContext } from "../types.js";

const CONTEXT_LINES = 3;

function lineNumberOf(content: string, charIdx: number): number {
  if (charIdx < 0) return 1;
  let line = 1;
  for (let i = 0; i < charIdx; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function pad(n: number, width = 5): string {
  return String(n).padStart(width, " ");
}

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
      const originalContent = readFileSync(filePath, "utf-8");

      if (!originalContent.includes(oldStr)) {
        return {
          output: "",
          error: `old_string not found in ${filePath}. Make sure it matches exactly including whitespace and indentation.`,
        };
      }

      const firstIdx = originalContent.indexOf(oldStr);
      const lastIdx = originalContent.lastIndexOf(oldStr);
      if (!replaceAll && firstIdx !== lastIdx) {
        return {
          output: "",
          error: `old_string appears multiple times in ${filePath}. Provide more context to make it unique, or set replace_all to true.`,
        };
      }

      const newContent = replaceAll
        ? originalContent.split(oldStr).join(newStr)
        : originalContent.replace(oldStr, newStr);

      writeFileSync(filePath, newContent);

      const oldLineCount = oldStr.split("\n").length;
      const newLineCount = newStr.split("\n").length;
      const startLineOld = lineNumberOf(originalContent, firstIdx);
      const startLineNew = lineNumberOf(newContent, newContent.indexOf(newStr));

      const oldLines = oldStr.split("\n");
      const newLines = newStr.split("\n");
      const newFileLines = newContent.split("\n");

      const beforeStart = Math.max(1, startLineNew - CONTEXT_LINES);
      const beforeEnd = startLineNew - 1;
      const afterStart = startLineNew + newLineCount;
      const afterEnd = Math.min(newFileLines.length, afterStart + CONTEXT_LINES - 1);

      const out: string[] = [];
      const summary =
        oldLineCount === newLineCount
          ? `Edited ${oldLineCount} line${oldLineCount === 1 ? "" : "s"}`
          : oldLineCount > newLineCount
            ? `Removed ${oldLineCount - newLineCount} line${oldLineCount - newLineCount === 1 ? "" : "s"}`
            : `Added ${newLineCount - oldLineCount} line${newLineCount - oldLineCount === 1 ? "" : "s"}`;

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

      return { output: out.join("\n") };
    } catch (err: any) {
      return { output: "", error: `Failed to edit file: ${err.message}` };
    }
  },
};
