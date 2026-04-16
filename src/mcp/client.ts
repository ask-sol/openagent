import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Tool, ToolResult, ToolContext } from "../tools/types.js";
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
  config: McpServerConfig
): Promise<McpConnection> {
  const existing = connections.get(name);
  if (existing) return existing;

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: { ...process.env, ...config.env } as Record<string, string>,
  });

  const client = new Client(
    { name: "openagent", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  await client.connect(transport);

  const toolsResult = await client.listTools();
  const tools: McpToolDef[] = (toolsResult.tools || []).map((t: any) => ({
    name: t.name,
    description: t.description || "",
    inputSchema: t.inputSchema || { type: "object", properties: {} },
  }));

  const connection: McpConnection = { name, client, transport, tools };
  connections.set(name, connection);

  return connection;
}

export async function connectAllMcpServers(): Promise<McpConnection[]> {
  const configs = loadMcpConfig();
  const results: McpConnection[] = [];

  for (const [name, config] of Object.entries(configs)) {
    try {
      const conn = await connectMcpServer(name, config);
      results.push(conn);
    } catch (err: any) {
      console.error(`Failed to connect MCP server "${name}": ${err.message}`);
    }
  }

  return results;
}

export async function disconnectAllMcpServers(): Promise<void> {
  for (const [name, conn] of connections) {
    try {
      await conn.client.close();
    } catch {}
    connections.delete(name);
  }
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
  args: Record<string, unknown>
): Promise<ToolResult> {
  const parts = fullName.replace("mcp_", "").split("_");
  const serverName = parts[0];
  const toolName = parts.slice(1).join("_");

  const conn = connections.get(serverName);
  if (!conn) {
    return { output: "", error: `MCP server "${serverName}" not connected` };
  }

  try {
    const result = await conn.client.callTool({ name: toolName, arguments: args });
    const content = result.content as any[];
    const text = content
      .map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c)))
      .join("\n");
    return { output: text };
  } catch (err: any) {
    return { output: "", error: `MCP tool error: ${err.message}` };
  }
}

export function getMcpConnectionStatus(): Array<{ name: string; toolCount: number }> {
  return Array.from(connections.entries()).map(([name, conn]) => ({
    name,
    toolCount: conn.tools.length,
  }));
}
