import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "../index.js";
import type { Tool } from "../../tools/types.js";

const depAuditTool: Tool = {
  name: "DepAudit",
  description:
    "Run a security audit on project dependencies (npm audit / pip-audit / cargo audit). Returns vulnerabilities by severity.",
  parameters: { type: "object", properties: {} },
  async execute(_input, ctx) {
    let cmd: string | null = null;
    if (existsSync(join(ctx.cwd, "package.json"))) cmd = "npm audit --json";
    else if (existsSync(join(ctx.cwd, "Cargo.toml"))) cmd = "cargo audit --json";
    else if (existsSync(join(ctx.cwd, "pyproject.toml")) || existsSync(join(ctx.cwd, "requirements.txt")))
      cmd = "pip-audit -f json";
    if (!cmd) return { output: "", error: "No supported dep manifest (package.json / Cargo.toml / pyproject.toml)." };

    return new Promise((resolve) => {
      exec(cmd!, { cwd: ctx.cwd, timeout: 120000, maxBuffer: 20 * 1024 * 1024 }, (_err, stdout, stderr) => {
        try {
          const data = JSON.parse(stdout || stderr);
          if (data.metadata?.vulnerabilities) {
            const v = data.metadata.vulnerabilities;
            const summary = `npm audit — total: ${v.total ?? 0} (critical: ${v.critical ?? 0}, high: ${v.high ?? 0}, moderate: ${v.moderate ?? 0}, low: ${v.low ?? 0})`;
            return resolve({ output: summary + "\n\n" + JSON.stringify(data.vulnerabilities || {}, null, 2).slice(0, 4000) });
          }
          resolve({ output: stdout.slice(0, 6000) || stderr.slice(0, 6000) });
        } catch {
          resolve({ output: (stdout + stderr).slice(0, 6000) });
        }
      });
    });
  },
};

export const depAuditPlugin: Plugin = {
  id: "dep-audit",
  name: "Dependency Audit",
  description: "Runs npm audit / cargo audit / pip-audit and surfaces vulnerabilities",
  category: "code-quality",
  tools: [depAuditTool],
};
