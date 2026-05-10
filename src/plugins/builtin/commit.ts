import { exec } from "node:child_process";
import { isWindows } from "../../utils/platform.js";
import type { Plugin } from "../index.js";
import type { Tool } from "../../tools/types.js";

const SHELL_OPTS = isWindows()
  ? { shell: "powershell.exe" as const, windowsHide: true }
  : { windowsHide: true };

const commitMsgTool: Tool = {
  name: "CommitMessage",
  description:
    "Read the staged git diff and propose a Conventional Commits message (e.g. 'feat: add login endpoint'). Returns the message and the files changed — does NOT commit. Use after the user stages files.",
  parameters: { type: "object", properties: {} },
  async execute(_input, ctx) {
    return new Promise((resolve) => {
      exec(
        "git diff --staged --stat",
        { cwd: ctx.cwd, timeout: 10000, maxBuffer: 5 * 1024 * 1024, ...SHELL_OPTS },
        (err, statOut) => {
          if (err) return resolve({ output: "", error: "git diff failed — are you in a git repo with staged changes?" });
          if (!statOut.trim()) {
            return resolve({ output: "", error: "No staged changes. Run `git add <files>` first." });
          }
          exec(
            "git diff --staged",
            { cwd: ctx.cwd, timeout: 10000, maxBuffer: 5 * 1024 * 1024, ...SHELL_OPTS },
            (err2, diffOut) => {
              if (err2) return resolve({ output: "", error: "git diff failed" });
              const truncDiff = diffOut.length > 8000 ? diffOut.slice(0, 8000) + "\n[…truncated]" : diffOut;
              resolve({
                output: `Staged files:\n${statOut.trim()}\n\nFull diff (use this to write a Conventional Commits message — feat / fix / chore / refactor / docs / test):\n${truncDiff}`,
              });
            },
          );
        },
      );
    });
  },
};

export const commitPlugin: Plugin = {
  id: "commit",
  name: "Commit Helper",
  description: "Reads your staged diff so the agent can write a clean commit message",
  category: "git",
  tools: [commitMsgTool],
};
