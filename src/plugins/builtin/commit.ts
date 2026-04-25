import { exec } from "node:child_process";
import type { Plugin } from "../index.js";
import type { Tool } from "../../tools/types.js";

const commitMsgTool: Tool = {
  name: "CommitMessage",
  description:
    "Read the staged git diff and propose a Conventional Commits message (e.g. 'feat: add login endpoint'). Returns the message and the files changed — does NOT commit. Use after the user stages files.",
  parameters: { type: "object", properties: {} },
  async execute(_input, ctx) {
    return new Promise((resolve) => {
      exec(
        "git diff --staged --stat && echo '---DIFF---' && git diff --staged",
        { cwd: ctx.cwd, timeout: 10000, maxBuffer: 5 * 1024 * 1024 },
        (err, stdout) => {
          if (err) return resolve({ output: "", error: "git diff failed — are you in a git repo with staged changes?" });
          const out = stdout.trim();
          if (!out || !out.includes("---DIFF---")) {
            return resolve({ output: "", error: "No staged changes. Run `git add <files>` first." });
          }
          const [stat, diff] = out.split("---DIFF---");
          const truncDiff = diff.length > 8000 ? diff.slice(0, 8000) + "\n[…truncated]" : diff;
          resolve({
            output: `Staged files:\n${stat.trim()}\n\nFull diff (use this to write a Conventional Commits message — feat / fix / chore / refactor / docs / test):\n${truncDiff}`,
          });
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
