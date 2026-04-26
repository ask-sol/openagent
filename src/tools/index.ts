import { bashTool } from "./BashTool/index.js";
import { fileReadTool } from "./FileReadTool/index.js";
import { fileEditTool } from "./FileEditTool/index.js";
import { fileWriteTool } from "./FileWriteTool/index.js";
import { globTool } from "./GlobTool/index.js";
import { grepTool } from "./GrepTool/index.js";
import { webSearchTool } from "./WebSearchTool/index.js";
import { webFetchTool } from "./WebFetchTool/index.js";
import { redditPostTool } from "./RedditTool/index.js";
import { xPostTool } from "./XTool/index.js";
import { todoWriteTool } from "./TodoWriteTool/index.js";
import { uploadTool } from "./UploadTool/index.js";
import { getEnabledPluginTools } from "../plugins/index.js";
import { getMcpTools, callMcpTool } from "../mcp/client.js";
import type { Tool } from "./types.js";
import { toolToProviderFormat } from "./types.js";
import type { ProviderTool } from "../providers/types.js";

const baseTools: Tool[] = [
  bashTool,
  fileReadTool,
  fileEditTool,
  fileWriteTool,
  globTool,
  grepTool,
  webSearchTool,
  webFetchTool,
  todoWriteTool,
  uploadTool,
  redditPostTool,
  xPostTool,
];

export const allTools: Tool[] = [...baseTools, ...getEnabledPluginTools()];

const toolMap = new Map<string, Tool>();
for (const tool of allTools) {
  toolMap.set(tool.name, tool);
}

export function getTool(name: string): Tool | undefined {
  // MCP tools are dynamic — connections form at runtime so we look them up live.
  if (name.startsWith("mcp_")) {
    return {
      name,
      description: "",
      parameters: {},
      async execute(input) {
        return callMcpTool(name, input);
      },
    };
  }
  return toolMap.get(name);
}

export function getToolsForProvider(): ProviderTool[] {
  return [...allTools.map(toolToProviderFormat), ...getMcpTools()];
}

export type { Tool, ToolResult, ToolContext } from "./types.js";
