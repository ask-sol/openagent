import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "./settings.js";

export type PermissionMode = "standard" | "cautious" | "unrestricted";

export interface PermissionRule {
  tool: string;
  behavior: "allow" | "deny" | "ask";
  pattern?: string;
}

export interface PermissionState {
  mode: PermissionMode;
  globalRules: PermissionRule[];
  projectRules: PermissionRule[];
  confirmedUnrestrictedDirs: string[];
}

const PERMISSIONS_FILE = "permissions.json";

const MODE_META: Record<PermissionMode, { label: string; symbol: string; color: string; description: string }> = {
  standard: {
    label: "Standard",
    symbol: "~",
    color: "yellow",
    description: "Asks before file writes, shell commands, and network requests",
  },
  cautious: {
    label: "Cautious",
    symbol: "!",
    color: "red",
    description: "Asks before every tool execution",
  },
  unrestricted: {
    label: "Unrestricted",
    symbol: "*",
    color: "magenta",
    description: "No permission prompts — all tools auto-approved. Use with care.",
  },
};

export function getModeMeta(mode: PermissionMode) {
  return MODE_META[mode];
}

export function getAllModes() {
  return Object.entries(MODE_META).map(([id, meta]) => ({ id: id as PermissionMode, ...meta }));
}

function getPermissionsPath(): string {
  return join(getConfigDir(), PERMISSIONS_FILE);
}

function getProjectPermissionsPath(): string {
  return join(process.cwd(), ".openagent", "permissions.json");
}

export function loadPermissions(): PermissionState {
  const path = getPermissionsPath();
  if (!existsSync(path)) {
    return {
      mode: "standard",
      globalRules: [],
      projectRules: [],
      confirmedUnrestrictedDirs: [],
    };
  }

  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {
      mode: "standard",
      globalRules: [],
      projectRules: [],
      confirmedUnrestrictedDirs: [],
    };
  }
}

export function savePermissions(state: PermissionState): void {
  writeFileSync(getPermissionsPath(), JSON.stringify(state, null, 2));
}

export function getEffectiveMode(): PermissionMode {
  return loadPermissions().mode;
}

export function setMode(mode: PermissionMode): void {
  const state = loadPermissions();
  state.mode = mode;
  savePermissions(state);
}

export function isUnrestrictedConfirmedForDir(dir: string): boolean {
  const state = loadPermissions();
  return state.confirmedUnrestrictedDirs.includes(dir);
}

export function confirmUnrestrictedForDir(dir: string): void {
  const state = loadPermissions();
  if (!state.confirmedUnrestrictedDirs.includes(dir)) {
    state.confirmedUnrestrictedDirs.push(dir);
  }
  state.mode = "unrestricted";
  savePermissions(state);
}

export function addRule(rule: PermissionRule, scope: "global" | "project"): void {
  const state = loadPermissions();
  const list = scope === "global" ? state.globalRules : state.projectRules;
  const existing = list.findIndex((r) => r.tool === rule.tool && r.pattern === rule.pattern);
  if (existing >= 0) {
    list[existing] = rule;
  } else {
    list.push(rule);
  }
  savePermissions(state);
}

export function removeRule(tool: string, scope: "global" | "project"): void {
  const state = loadPermissions();
  if (scope === "global") {
    state.globalRules = state.globalRules.filter((r) => r.tool !== tool);
  } else {
    state.projectRules = state.projectRules.filter((r) => r.tool !== tool);
  }
  savePermissions(state);
}

export function shouldPrompt(toolName: string): boolean {
  const state = loadPermissions();

  if (state.mode === "unrestricted") return false;
  if (state.mode === "cautious") return true;

  const allRules = [...state.projectRules, ...state.globalRules];
  for (const rule of allRules) {
    if (rule.tool === toolName || rule.tool === "*") {
      if (rule.behavior === "allow") return false;
      if (rule.behavior === "deny") return false;
      if (rule.behavior === "ask") return true;
    }
  }

  const alwaysAsk = ["Bash", "FileWrite", "FileEdit", "RedditPost", "XPost"];
  return alwaysAsk.includes(toolName);
}

export function isDenied(toolName: string): boolean {
  const state = loadPermissions();
  const allRules = [...state.projectRules, ...state.globalRules];
  for (const rule of allRules) {
    if ((rule.tool === toolName || rule.tool === "*") && rule.behavior === "deny") {
      return true;
    }
  }
  return false;
}
