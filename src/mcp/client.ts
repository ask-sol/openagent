import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ToolResult } from "../tools/types.js";
import type { ProviderTool } from "../providers/types.js";

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpConnection {
  name: string;
  client: Client;
  transport: StdioClientTransport;
  tools: McpToolDef[];
}

interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const connections: Map<string, McpConnection> = new Map();
const failures: Map<string, string> = new Map();

const CONNECT_TIMEOUT_MS = 30_000;
const TOOL_LIST_TIMEOUT_MS = 15_000;
const MCP_LOG_DIR = join(homedir(), ".openagent");
const MCP_LOG = join(MCP_LOG_DIR, "mcp.log");

function logToFile(line: string) {
  try {
    if (!existsSync(MCP_LOG_DIR)) mkdirSync(MCP_LOG_DIR, { recursive: true });
    appendFileSync(MCP_LOG, `[${new Date().toISOString()}] ${line}\n`);
  } catch {}
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function loadMcpConfig(): Record<string, McpServerConfig> {
  const configPaths = [
    join(homedir(), ".openagent", "mcp_servers.json"),
    join(process.cwd(), ".openagent", "mcp_servers.json"),
  ];

  let allConfigs: Record<string, McpServerConfig> = {};

  for (const path of configPaths) {
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        const parsed = JSON.parse(raw);
        const servers = parsed.mcpServers || parsed;
        allConfigs = { ...allConfigs, ...servers };
      } catch {}
    }
  }

  return allConfigs;
}

export async function connectMcpServer(
  name: string,
  config: McpServerConfig,
): Promise<McpConnection> {
  const existing = connections.get(name);
  if (existing) return existing;

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: { ...process.env, ...config.env } as Record<string, string>,
    // Pipe stderr to our log file instead of letting it accumulate in memory.
    // The SDK already does newline-delimited JSON on stdout; stderr left to
    // default behaviour can balloon for chatty children (npx, puppeteer, etc.).
    stderr: "pipe",
  });

  // Drain stderr to a rotating log so it never grows the parent heap.
  // (StdioClientTransport exposes the spawned process via .stderr getter.)
  try {
    const stderr = (transport as any).stderr;
    if (stderr && typeof stderr.on === "function") {
      let total = 0;
      const cap = 256 * 1024; // 256 KB per server is plenty
      stderr.on("data", (chunk: Buffer) => {
        const remaining = cap - total;
        if (remaining <= 0) return;
        const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
        total += slice.length;
        logToFile(`[${name}/stderr] ${slice.toString().replace(/\s+$/, "")}`);
      });
    }
  } catch {}

  const client = new Client(
    { name: "openagent", version: "0.1.0" },
    { capabilities: {} },
  );

  try {
    await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, `MCP "${name}" connect`);
  } catch (err: any) {
    try { await transport.close(); } catch {}
    failures.set(name, err.message || "unknown error");
    logToFile(`[${name}] connect failed: ${err.message}`);
    throw err;
  }

  let tools: McpToolDef[] = [];
  try {
    const toolsResult = await withTimeout(
      client.listTools(),
      TOOL_LIST_TIMEOUT_MS,
      `MCP "${name}" listTools`,
    );
    tools = (toolsResult.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description || "",
      inputSchema: t.inputSchema || { type: "object", properties: {} },
    }));
  } catch (err: any) {
    // Connected but listTools failed/timed out — keep the connection,
    // expose zero tools, and log the issue.
    failures.set(name, `connected but listTools failed: ${err.message}`);
    logToFile(`[${name}] listTools failed: ${err.message}`);
  }

  const connection: McpConnection = { name, client, transport, tools };
  connections.set(name, connection);
  failures.delete(name);
  logToFile(`[${name}] connected with ${tools.length} tool(s)`);

  return connection;
}

export async function connectAllMcpServers(): Promise<McpConnection[]> {
  const configs = loadMcpConfig();
  const entries = Object.entries(configs);
  if (entries.length === 0) return [];

  // Connect in parallel — one slow server must not block the others.
  const settled = await Promise.allSettled(
    entries.map(([name, config]) =>
      connectMcpServer(name, config).catch((err) => {
        // Swallow here so Promise.allSettled sees a fulfilled-with-null
        // and we can keep going. The error is already in `failures`.
        return null as any;
      }),
    ),
  );

  return settled
    .filter((r): r is PromiseFulfilledResult<McpConnection> => r.status === "fulfilled" && r.value != null)
    .map((r) => r.value);
}

export async function disconnectAllMcpServers(): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const [name, conn] of connections) {
    tasks.push(
      withTimeout(conn.transport.close(), 3_000, `MCP "${name}" close`).catch(() => {}),
    );
  }
  await Promise.all(tasks);
  connections.clear();
  failures.clear();
}

export function getMcpTools(): ProviderTool[] {
  const tools: ProviderTool[] = [];
  for (const [serverName, conn] of connections) {
    for (const tool of conn.tools) {
      tools.push({
        type: "function",
        function: {
          name: `mcp_${serverName}_${tool.name}`,
          description: `[MCP: ${serverName}] ${tool.description}`,
          parameters: tool.inputSchema,
        },
      });
    }
  }
  return tools;
}

export async function callMcpTool(
  fullName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const withoutPrefix = fullName.replace(/^mcp_/, "");
  const firstUnderscore = withoutPrefix.indexOf("_");
  if (firstUnderscore === -1) {
    return { output: "", error: `Invalid MCP tool name: ${fullName}` };
  }
  const serverName = withoutPrefix.slice(0, firstUnderscore);
  const toolName = withoutPrefix.slice(firstUnderscore + 1);

  const conn = connections.get(serverName);
  if (!conn) {
    return { output: "", error: `MCP server "${serverName}" not connected` };
  }

  try {
    const result = await withTimeout(
      conn.client.callTool({ name: toolName, arguments: args }),
      60_000,
      `MCP tool ${fullName}`,
    );
    const content = result.content as any[];
    const text = content
      .map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c)))
      .join("\n");
    return { output: text };
  } catch (err: any) {
    return { output: "", error: `MCP tool error: ${err.message}` };
  }
}

export function getMcpConnectionStatus(): Array<{ name: string; toolCount: number; error?: string }> {
  const live = Array.from(connections.entries()).map(([name, conn]) => ({
    name,
    toolCount: conn.tools.length,
  }));
  const failed = Array.from(failures.entries()).map(([name, error]) => ({
    name,
    toolCount: 0,
    error,
  }));
  return [...live, ...failed];
}

export function getMcpFailures(): Array<{ name: string; error: string }> {
  return Array.from(failures.entries()).map(([name, error]) => ({ name, error }));
}
