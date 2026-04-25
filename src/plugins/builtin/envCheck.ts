import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "../index.js";
import type { Tool } from "../../tools/types.js";

function findFiles(root: string, pattern: RegExp, max = 200): string[] {
  const found: string[] = [];
  const stack = [root];
  while (stack.length && found.length < max) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.name.startsWith(".git") || e.name === "node_modules" || e.name === "dist") continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (pattern.test(e.name)) found.push(full);
    }
  }
  return found;
}

const envCheckTool: Tool = {
  name: "EnvCheck",
  description:
    "Scan the codebase for process.env / os.environ references and check which are missing from .env files. Catches misconfigured environment.",
  parameters: { type: "object", properties: {} },
  async execute(_input, ctx) {
    const codeFiles = findFiles(ctx.cwd, /\.(ts|tsx|js|jsx|mjs|py|go|rs)$/);
    const referenced = new Set<string>();
    const refRegexes = [
      /process\.env\.([A-Z][A-Z0-9_]*)/g,
      /process\.env\["([A-Z][A-Z0-9_]*)"\]/g,
      /os\.environ\.get\(\s*["']([A-Z][A-Z0-9_]*)["']/g,
      /os\.environ\[["']([A-Z][A-Z0-9_]*)["']\]/g,
      /env::var\(\s*["']([A-Z][A-Z0-9_]*)["']\)/g,
    ];
    for (const file of codeFiles.slice(0, 500)) {
      try {
        const stat = statSync(file);
        if (stat.size > 1024 * 1024) continue;
        const content = readFileSync(file, "utf-8");
        for (const re of refRegexes) {
          let m;
          while ((m = re.exec(content)) !== null) referenced.add(m[1]);
        }
      } catch {}
    }

    const envFiles = [".env", ".env.local", ".env.example", ".env.development"]
      .map((n) => join(ctx.cwd, n))
      .filter(existsSync);
    const declared = new Set<string>();
    for (const f of envFiles) {
      try {
        for (const line of readFileSync(f, "utf-8").split("\n")) {
          const m = line.match(/^([A-Z][A-Z0-9_]*)\s*=/);
          if (m) declared.add(m[1]);
        }
      } catch {}
    }

    const missing = [...referenced].filter((k) => !declared.has(k) && !process.env[k]);
    const unused = [...declared].filter((k) => !referenced.has(k));

    const out: string[] = [];
    out.push(`Referenced in code: ${referenced.size} unique env vars`);
    out.push(`Declared in .env files: ${declared.size}`);
    out.push("");
    if (missing.length) {
      out.push(`⚠ ${missing.length} referenced but not in .env or process.env:`);
      for (const k of missing.slice(0, 30)) out.push(`  - ${k}`);
    } else {
      out.push("✓ All referenced env vars are declared.");
    }
    if (unused.length) {
      out.push("");
      out.push(`Unused (declared but not referenced):`);
      for (const k of unused.slice(0, 30)) out.push(`  - ${k}`);
    }
    return { output: out.join("\n") };
  },
};

export const envCheckPlugin: Plugin = {
  id: "envcheck",
  name: "Env Checker",
  description: "Find env vars your code uses but forgot to set in .env",
  category: "config",
  tools: [envCheckTool],
};
