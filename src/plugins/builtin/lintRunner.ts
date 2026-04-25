import { exec } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "../index.js";
import type { Tool } from "../../tools/types.js";

function detectLinter(cwd: string): { cmd: string; reason: string } | null {
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const scripts = pkg.scripts || {};
      if (scripts.lint) return { cmd: `npm run lint`, reason: "package.json has 'lint' script" };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.eslint) return { cmd: `npx eslint .`, reason: "eslint is in dependencies" };
      if (deps.biome) return { cmd: `npx biome check .`, reason: "biome is in dependencies" };
    } catch {}
  }
  if (existsSync(join(cwd, "ruff.toml")) || existsSync(join(cwd, "pyproject.toml"))) {
    return { cmd: "ruff check .", reason: "ruff config detected" };
  }
  if (existsSync(join(cwd, "Cargo.toml"))) return { cmd: "cargo clippy", reason: "Cargo project" };
  if (existsSync(join(cwd, "go.mod"))) return { cmd: "go vet ./...", reason: "Go project" };
  return null;
}

const lintRunTool: Tool = {
  name: "Lint",
  description:
    "Run the project's linter automatically (eslint, biome, ruff, clippy, go vet) and return findings. Detects which linter to use from package.json/Cargo.toml/etc.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Optional path to lint. Defaults to whole project.",
      },
    },
  },
  async execute(input, ctx) {
    const detected = detectLinter(ctx.cwd);
    if (!detected) return { output: "", error: "No supported linter detected. Install eslint, biome, ruff, clippy, or add a 'lint' script." };
    const path = (input.path as string) || "";
    const fullCmd = path ? `${detected.cmd} ${path}` : detected.cmd;
    return new Promise((resolve) => {
      exec(fullCmd, { cwd: ctx.cwd, timeout: 60000, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
        const out = (stdout + stderr).trim();
        const head = `Linter: ${detected.cmd} (${detected.reason})\n\n`;
        if (err && !out) return resolve({ output: "", error: `Lint failed: ${err.message}` });
        resolve({ output: head + (out || "✓ No issues found.") });
      });
    });
  },
};

export const lintRunnerPlugin: Plugin = {
  id: "linter",
  name: "Linter",
  description: "Find and fix code style issues automatically",
  category: "code-quality",
  tools: [lintRunTool],
};
