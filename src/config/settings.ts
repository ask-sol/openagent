import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type ResponseMode = "concise" | "explanative";

export interface OpenAgentSettings {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  responseMode: ResponseMode;
  maxTokens?: number;
  setupComplete: boolean;
  mcpServers?: Record<string, McpServerConfig>;
  reddit?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    username: string;
  };
  x?: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessSecret: string;
  };
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

const CONFIG_DIR = join(homedir(), ".openagent");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getConfigDir(): string {
  ensureConfigDir();
  return CONFIG_DIR;
}

export function loadSettings(): OpenAgentSettings {
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    return {
      provider: "",
      model: "",
      apiKey: "",
      responseMode: "concise",
      setupComplete: false,
    };
  }

  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      provider: "",
      model: "",
      apiKey: "",
      responseMode: "concise",
      setupComplete: false,
    };
  }
}

export function saveSettings(settings: OpenAgentSettings): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2));
}

export function updateSettings(partial: Partial<OpenAgentSettings>): OpenAgentSettings {
  const current = loadSettings();
  const updated = { ...current, ...partial };
  saveSettings(updated);
  return updated;
}

export function getSessionsDir(): string {
  const dir = join(CONFIG_DIR, "sessions");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function getContextSessionPath(cwd: string): string {
  const safeName = cwd.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 100);
  return join(CONFIG_DIR, "sessions", `CONTEXT_${safeName}.session`);
}
