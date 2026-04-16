import { exec } from "node:child_process";
import type { Tool, ToolResult, ToolContext } from "../types.js";

export const bashTool: Tool = {
  name: "Bash",
  description:
    "Execute a shell command and return its output. Use for system commands, git operations, package management, running tests, and build commands.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute",
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds (default 120000, max 600000)",
      },
    },
    required: ["command"],
  },

  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const command = input.command as string;
    const timeout = Math.min((input.timeout as number) || 120000, 600000);

    return new Promise((resolve) => {
      const child = exec(command, {
        cwd: context.cwd,
        timeout,
        maxBuffer: 1024 * 1024 * 10,
        env: { ...process.env, FORCE_COLOR: "0" },
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data;
      });

      child.stderr?.on("data", (data) => {
        stderr += data;
      });

      child.on("close", (code) => {
        const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");
        if (code !== 0) {
          resolve({
            output: output || `Command failed with exit code ${code}`,
            error: `Exit code ${code}`,
          });
        } else {
          resolve({ output: output || "(no output)" });
        }
      });

      child.on("error", (err) => {
        resolve({
          output: "",
          error: `Failed to execute: ${err.message}`,
        });
      });

      if (context.abortSignal) {
        context.abortSignal.addEventListener("abort", () => {
          child.kill("SIGTERM");
        });
      }
    });
  },
};
