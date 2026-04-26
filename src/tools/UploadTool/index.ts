import { isAbsolute, resolve } from "node:path";
import { existsSync } from "node:fs";
import type { Tool, ToolResult, ToolContext } from "../types.js";
import { startShareSession, formatShareSummary } from "../../utils/fileShare.js";

/**
 * Module-level pending session callback so the REPL can subscribe and render
 * the QR code in the chat area when the agent invokes Upload.
 */
type SessionListener = (summary: string, doneMessage: Promise<string>) => void;
let listener: SessionListener | null = null;

export function setUploadListener(fn: SessionListener | null): void {
  listener = fn;
}

export const uploadTool: Tool = {
  name: "Upload",
  description:
    "Share a local file from the user's machine over their LAN with a one-shot HTTP download URL and a scannable QR code. " +
    "Use this whenever the user asks to share, send, or upload a file to their phone or another device on the same network. " +
    "The server stops automatically after one download.",
  parameters: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Absolute or relative path to the file to share.",
      },
    },
    required: ["file_path"],
  },

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const raw = input.file_path as string;
    const filePath = isAbsolute(raw) ? raw : resolve(ctx.cwd, raw);
    if (!existsSync(filePath)) {
      return { output: "", error: `File not found: ${filePath}` };
    }

    try {
      const session = await startShareSession(filePath);
      const summary = formatShareSummary(session);

      const donePromise = session.done.then(
        (info) =>
          `✓ ${session.fileName} downloaded by ${info.downloadedBy} at ${info.at.toLocaleTimeString()}. Server stopped.`,
      );

      if (listener) listener(summary, donePromise);

      // Return a concise result for the model — full QR is handled by the UI.
      return {
        output: `Sharing ${session.fileName} at ${session.url}\nServer will stop after one download. QR code displayed in the terminal.`,
      };
    } catch (err: any) {
      return { output: "", error: `Upload failed: ${err.message}` };
    }
  },
};
