import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join, relative } from "node:path";
import { homedir } from "node:os";
import type { Plugin } from "../index.js";
import type { Tool } from "../../tools/types.js";

const SNAPSHOT_ROOT = join(homedir(), ".openagent", "snapshots");

function walk(dir: string, base: string, files: string[]) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".git") || e.name === "node_modules" || e.name === "dist" || e.name === ".next") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, base, files);
    else files.push(relative(base, full));
  }
}

const snapshotCreateTool: Tool = {
  name: "SnapshotCreate",
  description:
    "Create a quick snapshot of the project (sourcefiles only — skips node_modules, .git, dist). Use before risky changes; SnapshotRestore can roll back.",
  parameters: {
    type: "object",
    properties: { label: { type: "string", description: "Short label for the snapshot" } },
    required: ["label"],
  },
  async execute(input, ctx) {
    const label = (input.label as string).trim().replace(/[^\w-]/g, "_").slice(0, 40);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dest = join(SNAPSHOT_ROOT, `${stamp}_${label}`);
    mkdirSync(dest, { recursive: true });

    const files: string[] = [];
    try {
      walk(ctx.cwd, ctx.cwd, files);
    } catch (err: any) {
      return { output: "", error: `walk failed: ${err.message}` };
    }

    let count = 0;
    let bytes = 0;
    for (const rel of files) {
      try {
        const src = join(ctx.cwd, rel);
        const tgt = join(dest, rel);
        const tgtDir = tgt.substring(0, tgt.lastIndexOf("/"));
        if (!existsSync(tgtDir)) mkdirSync(tgtDir, { recursive: true });
        copyFileSync(src, tgt);
        bytes += statSync(src).size;
        count++;
      } catch {}
    }
    writeFileSync(join(dest, ".snapshot.json"), JSON.stringify({ cwd: ctx.cwd, label, files: count, bytes, stamp }, null, 2));
    return { output: `Snapshot created: ${stamp}_${label} (${count} files, ${(bytes / 1024).toFixed(1)} KB)\nLocation: ${dest}` };
  },
};

const snapshotListTool: Tool = {
  name: "SnapshotList",
  description: "List existing snapshots for this project.",
  parameters: { type: "object", properties: {} },
  async execute(_input, ctx) {
    if (!existsSync(SNAPSHOT_ROOT)) return { output: "No snapshots yet." };
    const entries = readdirSync(SNAPSHOT_ROOT)
      .map((n) => {
        const meta = join(SNAPSHOT_ROOT, n, ".snapshot.json");
        if (!existsSync(meta)) return null;
        try {
          const m = JSON.parse(readFileSync(meta, "utf-8"));
          if (m.cwd !== ctx.cwd) return null;
          return `  ${n} — ${m.files} files`;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return { output: entries.length ? `Snapshots:\n${entries.join("\n")}` : "No snapshots for this project." };
  },
};

const snapshotRestoreTool: Tool = {
  name: "SnapshotRestore",
  description:
    "Restore files from a snapshot back to the project. CONFIRMS by listing files first. Use only when explicitly asked to roll back.",
  parameters: {
    type: "object",
    properties: { snapshot_id: { type: "string", description: "Snapshot directory name (from SnapshotList)" } },
    required: ["snapshot_id"],
  },
  async execute(input, ctx) {
    const id = input.snapshot_id as string;
    const dir = join(SNAPSHOT_ROOT, id);
    if (!existsSync(dir)) return { output: "", error: `Snapshot not found: ${id}` };
    const meta = JSON.parse(readFileSync(join(dir, ".snapshot.json"), "utf-8"));
    if (meta.cwd !== ctx.cwd) return { output: "", error: "Snapshot belongs to a different project." };

    const files: string[] = [];
    walk(dir, dir, files);
    let restored = 0;
    for (const rel of files) {
      if (rel === ".snapshot.json") continue;
      try {
        const src = join(dir, rel);
        const tgt = join(ctx.cwd, rel);
        const tgtDir = tgt.substring(0, tgt.lastIndexOf("/"));
        if (!existsSync(tgtDir)) mkdirSync(tgtDir, { recursive: true });
        copyFileSync(src, tgt);
        restored++;
      } catch {}
    }
    return { output: `Restored ${restored} files from ${id}.` };
  },
};

export const snapshotPlugin: Plugin = {
  id: "snapshot",
  name: "Snapshot",
  description: "Save a backup before risky edits, restore in one click if it breaks",
  category: "safety",
  tools: [snapshotCreateTool, snapshotListTool, snapshotRestoreTool],
};
