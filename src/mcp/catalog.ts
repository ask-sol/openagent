import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { McpServerConfig } from "./client.js";

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: "files" | "vcs" | "data" | "browser" | "search" | "comms" | "memory";
  config: McpServerConfig;
  envVars?: Array<{ name: string; description: string; required: boolean }>;
  notes?: string;
}

export const CATALOG: CatalogEntry[] = [
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Read, write, and search files in a sandboxed directory",
    category: "files",
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "${PWD}"],
    },
  },
  {
    id: "git",
    name: "Git",
    description: "Inspect history, diffs, and branches of a local git repo",
    category: "vcs",
    config: {
      command: "uvx",
      args: ["mcp-server-git", "--repository", "${PWD}"],
    },
    notes: "Requires `uv` (https://github.com/astral-sh/uv).",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Search code, issues, PRs across GitHub via API",
    category: "vcs",
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_PAT}" },
    },
    envVars: [
      { name: "GITHUB_PAT", description: "GitHub personal access token (repo scope)", required: true },
    ],
  },
  {
    id: "postgres",
    name: "Postgres",
    description: "Query a Postgres database read-only",
    category: "data",
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres", "${POSTGRES_URL}"],
    },
    envVars: [
      { name: "POSTGRES_URL", description: "postgresql://user:pass@host:5432/db", required: true },
    ],
  },
  {
    id: "sqlite",
    name: "SQLite",
    description: "Query a local SQLite database file",
    category: "data",
    config: {
      command: "uvx",
      args: ["mcp-server-sqlite", "--db-path", "${SQLITE_PATH}"],
    },
    envVars: [
      { name: "SQLITE_PATH", description: "Absolute path to the .sqlite/.db file", required: true },
    ],
  },
  {
    id: "puppeteer",
    name: "Puppeteer",
    description: "Browse and screenshot live websites with a headless browser",
    category: "browser",
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    },
  },
  {
    id: "fetch",
    name: "Fetch",
    description: "Fetch arbitrary URLs and convert to markdown",
    category: "browser",
    config: {
      command: "uvx",
      args: ["mcp-server-fetch"],
    },
  },
  {
    id: "brave-search",
    name: "Brave Search",
    description: "Web and local search via Brave",
    category: "search",
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: { BRAVE_API_KEY: "${BRAVE_API_KEY}" },
    },
    envVars: [
      { name: "BRAVE_API_KEY", description: "Brave Search API key", required: true },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Read and post messages in Slack workspaces",
    category: "comms",
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-slack"],
      env: {
        SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}",
        SLACK_TEAM_ID: "${SLACK_TEAM_ID}",
      },
    },
    envVars: [
      { name: "SLACK_BOT_TOKEN", description: "Slack bot token (xoxb-...)", required: true },
      { name: "SLACK_TEAM_ID", description: "Slack workspace ID", required: true },
    ],
  },
  {
    id: "memory",
    name: "Memory",
    description: "Persistent knowledge graph the agent can read and write across sessions",
    category: "memory",
    config: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
    },
  },
];

const CONFIG_DIR = join(homedir(), ".openagent");
const CONFIG_PATH = join(CONFIG_DIR, "mcp_servers.json");

function readConfig(): { mcpServers: Record<string, McpServerConfig> } {
  if (!existsSync(CONFIG_PATH)) return { mcpServers: {} };
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return { mcpServers: parsed.mcpServers || parsed || {} };
  } catch {
    return { mcpServers: {} };
  }
}

function writeConfig(cfg: { mcpServers: Record<string, McpServerConfig> }): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function expand(template: string, env: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, key) => {
    if (key === "PWD") return process.cwd();
    return env[key] ?? process.env[key] ?? `\${${key}}`;
  });
}

export function getInstalledServerIds(): string[] {
  return Object.keys(readConfig().mcpServers);
}

export function isInstalled(id: string): boolean {
  return id in readConfig().mcpServers;
}

export function installServer(entry: CatalogEntry, env: Record<string, string> = {}): void {
  const cfg = readConfig();
  const expandedConfig: McpServerConfig = {
    command: expand(entry.config.command, env),
    args: entry.config.args?.map((a) => expand(a, env)),
    env: entry.config.env
      ? Object.fromEntries(
          Object.entries(entry.config.env).map(([k, v]) => [k, expand(v, env)]),
        )
      : undefined,
  };
  cfg.mcpServers[entry.id] = expandedConfig;
  writeConfig(cfg);
}

export function uninstallServer(id: string): void {
  const cfg = readConfig();
  delete cfg.mcpServers[id];
  writeConfig(cfg);
}
