import { exec } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "../index.js";
import type { Tool } from "../../tools/types.js";

function detectTestCmd(cwd: string): { cmd: string; reason: string } | null {
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const scripts = pkg.scripts || {};
      if (scripts.test) return { cmd: "npm test --silent", reason: "npm test script" };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.vitest) return { cmd: "npx vitest run", reason: "vitest detected" };
      if (deps.jest) return { cmd: "npx jest", reason: "jest detected" };
    } catch {}
  }
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "pytest.ini"))) {
    return { cmd: "pytest -q", reason: "pytest project" };
  }
  if (existsSync(join(cwd, "Cargo.toml"))) return { cmd: "cargo test", reason: "Cargo project" };
  if (existsSync(join(cwd, "go.mod"))) return { cmd: "go test ./...", reason: "Go project" };
  return null;
}

const testTool: Tool = {
  name: "Test",
  description:
    "Run the project's test suite. Auto-detects vitest/jest/pytest/cargo test/go test. Returns pass/fail counts and failure details.",
  parameters: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        description: "Optional name pattern to filter which tests run",
      },
    },
  },
  async execute(input, ctx) {
    const detected = detectTestCmd(ctx.cwd);
    if (!detected) return { output: "", error: "No test runner detected." };
    const filter = (input.filter as string) || "";
    const fullCmd = filter ? `${detected.cmd} ${filter}` : detected.cmd;
    return new Promise((resolve) => {
      exec(fullCmd, { cwd: ctx.cwd, timeout: 180000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        const out = (stdout + stderr).trim();
        const head = `Tests: ${detected.cmd} (${detected.reason})\n\n`;
        if (err && !out) return resolve({ output: "", error: `Tests failed to start: ${err.message}` });
        const status = err ? "Some tests failed." : "✓ All passed.";
        resolve({ output: head + (out.slice(-4000) || "(no output)") + `\n\n${status}` });
      });
    });
  },
};

export const testRunnerPlugin: Plugin = {
  id: "test-runner",
  name: "Test Runner",
  description: "Detects and runs vitest / jest / pytest / cargo test / go test",
  category: "code-quality",
  tools: [testTool],
};
