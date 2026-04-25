import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Tool } from "../tools/types.js";

import { lintRunnerPlugin } from "./builtin/lintRunner.js";
import { testRunnerPlugin } from "./builtin/testRunner.js";
import { stackTracePlugin } from "./builtin/stackTrace.js";
import { depAuditPlugin } from "./builtin/depAudit.js";
import { gitBlamePlugin } from "./builtin/gitBlame.js";
import { snapshotPlugin } from "./builtin/snapshot.js";
import { envCheckPlugin } from "./builtin/envCheck.js";

export interface Plugin {
  id: string;
  name: string;
  description: string;
  category: "code-quality" | "debugging" | "git" | "safety" | "config";
  tools: Tool[];
  /** Optional setup hook that runs when plugin is enabled (e.g. install npm dep). */
  setup?: () => Promise<void>;
}

export const BUILTIN_PLUGINS: Plugin[] = [
  lintRunnerPlugin,
  testRunnerPlugin,
  stackTracePlugin,
  depAuditPlugin,
  gitBlamePlugin,
  snapshotPlugin,
  envCheckPlugin,
];

const CONFIG_DIR = join(homedir(), ".openagent");
const CONFIG_PATH = join(CONFIG_DIR, "plugins.json");

interface PluginConfig {
  enabled: string[];
}

function readConfig(): PluginConfig {
  if (!existsSync(CONFIG_PATH)) return { enabled: [] };
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return { enabled: [] };
  }
}

function writeConfig(cfg: PluginConfig): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

export function getEnabledPluginIds(): string[] {
  return readConfig().enabled;
}

export function isPluginEnabled(id: string): boolean {
  return readConfig().enabled.includes(id);
}

export function enablePlugin(id: string): void {
  const cfg = readConfig();
  if (!cfg.enabled.includes(id)) cfg.enabled.push(id);
  writeConfig(cfg);
}

export function disablePlugin(id: string): void {
  const cfg = readConfig();
  cfg.enabled = cfg.enabled.filter((x) => x !== id);
  writeConfig(cfg);
}

export function getEnabledPluginTools(): Tool[] {
  const enabled = new Set(getEnabledPluginIds());
  return BUILTIN_PLUGINS.filter((p) => enabled.has(p.id)).flatMap((p) => p.tools);
}
