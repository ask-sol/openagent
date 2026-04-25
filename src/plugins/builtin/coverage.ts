import { exec } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "../index.js";
import type { Tool } from "../../tools/types.js";

function detectCoverageCmd(cwd: string): { cmd: string; reason: string } | null {
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.vitest) return { cmd: "npx vitest run --coverage --reporter=basic", reason: "vitest" };
      if (deps.jest) return { cmd: "npx jest --coverage --silent", reason: "jest" };
    } catch {}
  }
  if (existsSync(join(cwd, "pyproject.toml"))) return { cmd: "pytest --cov --cov-report=term", reason: "pytest-cov" };
  if (existsSync(join(cwd, "Cargo.toml"))) return { cmd: "cargo tarpaulin --out Stdout", reason: "tarpaulin" };
  return null;
}

const coverageTool: Tool = {
  name: "Coverage",
  description:
    "Run tests with coverage instrumentation and report which files are under-tested. Auto-detects vitest, jest, pytest-cov, or tarpaulin.",
  parameters: { type: "object", properties: {} },
  async execute(_input, ctx) {
    const detected = detectCoverageCmd(ctx.cwd);
    if (!detected) return { output: "", error: "No coverage runner detected. Install vitest/jest with coverage, pytest-cov, or tarpaulin." };
    return new Promise((resolve) => {
      exec(detected.cmd, { cwd: ctx.cwd, timeout: 240000, maxBuffer: 10 * 1024 * 1024 }, (_err, stdout, stderr) => {
        const out = (stdout + stderr).trim();
        const tail = out.length > 4000 ? out.slice(-4000) : out;
        resolve({ output: `Coverage via ${detected.reason}\n\n${tail || "(no output)"}` });
      });
    });
  },
};

export const coveragePlugin: Plugin = {
  id: "coverage",
  name: "Test Coverage",
  description: "See which files have weak test coverage",
  category: "code-quality",
  tools: [coverageTool],
};
