import { exec } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "../index.js";
import type { Tool } from "../../tools/types.js";

function detectFormatter(cwd: string): { cmd: string; reason: string } | null {
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const scripts = pkg.scripts || {};
      if (scripts.format) return { cmd: "npm run format", reason: "package.json format script" };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.prettier) return { cmd: "npx prettier --write .", reason: "prettier" };
      if (deps.biome) return { cmd: "npx biome format --write .", reason: "biome" };
    } catch {}
  }
  if (existsSync(join(cwd, "pyproject.toml"))) return { cmd: "ruff format .", reason: "ruff" };
  if (existsSync(join(cwd, "Cargo.toml"))) return { cmd: "cargo fmt", reason: "rustfmt" };
  if (existsSync(join(cwd, "go.mod"))) return { cmd: "gofmt -w .", reason: "gofmt" };
  return null;
}

const formatTool: Tool = {
  name: "Format",
  description:
    "Auto-format the project's source files with the right formatter (prettier, biome, ruff, rustfmt, gofmt).",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Optional path to format (default: whole project)" },
    },
  },
  async execute(input, ctx) {
    const detected = detectFormatter(ctx.cwd);
    if (!detected) return { output: "", error: "No supported formatter detected." };
    const path = (input.path as string) || "";
    const fullCmd = path ? detected.cmd.replace(/\.\s*$/, path) : detected.cmd;
    return new Promise((resolve) => {
      exec(fullCmd, { cwd: ctx.cwd, timeout: 60000, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
        const out = (stdout + stderr).trim();
        if (err && !out) return resolve({ output: "", error: `Format failed: ${err.message}` });
        resolve({ output: `Formatted with ${detected.reason}\n\n${out || "✓ All files formatted."}` });
      });
    });
  },
};

export const formatPlugin: Plugin = {
  id: "format",
  name: "Auto Format",
  description: "Format your code with prettier, biome, ruff, rustfmt, or gofmt",
  category: "code-quality",
  tools: [formatTool],
};
