import type { Provider, ProviderMessage, StreamChunk, ProviderToolCall, TokenUsage } from "./providers/types.js";
import { getTool, getToolsForProvider } from "./tools/index.js";
import type { ToolContext } from "./tools/types.js";
import { buildSystemPrompt } from "./utils/systemPrompt.js";
import { loadSettings } from "./config/settings.js";
import { shouldPrompt, isDenied, getEffectiveMode } from "./config/permissions.js";
import { loadContextSession, appendMessage, updateContextSession } from "./session/history.js";
import { exec } from "node:child_process";
import { readdirSync } from "node:fs";

export interface QueryCallbacks {
  onText: (text: string) => void;
  onToolStart: (name: string, id: string) => void;
  onToolEnd: (name: string, id: string, result: string, error?: string) => void;
  onToolPermission: (name: string, args: Record<string, unknown>) => Promise<boolean>;
  onDone: (usage: TokenUsage) => void;
  onError: (error: string) => void;
}

interface PendingToolCall {
  id: string;
  name: string;
  arguments: string;
}

function getGitBranch(cwd: string): Promise<string> {
  return new Promise((resolve) => {
    exec("git rev-parse --abbrev-ref HEAD 2>/dev/null", { cwd }, (err, stdout) => {
      resolve(err ? "" : stdout.trim());
    });
  });
}

function getTopLevelFiles(cwd: string): string[] {
  try {
    return readdirSync(cwd, { withFileTypes: true })
      .slice(0, 50)
      .map((d) => (d.isDirectory() ? `${d.name}/` : d.name));
  } catch {
    return [];
  }
}

function describeToolCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "Bash":
      return `Run command: ${(args.command as string || "").slice(0, 120)}`;
    case "FileEdit":
      return `Edit file: ${args.file_path}`;
    case "FileWrite":
      return `Write file: ${args.file_path}`;
    case "FileRead":
      return `Read file: ${args.file_path}`;
    case "Glob":
      return `Search files: ${args.pattern}`;
    case "Grep":
      return `Search content: ${args.pattern}`;
    case "WebSearch":
      return `Web search: ${args.query}`;
    case "WebFetch":
      return `Fetch URL: ${args.url}`;
    case "RedditPost":
      return `Post to r/${args.subreddit}: ${args.title}`;
    case "XPost":
      return `Tweet: ${(args.text as string || "").slice(0, 80)}`;
    default:
      return `${name}: ${JSON.stringify(args).slice(0, 100)}`;
  }
}

export async function runQueryLoop(
  provider: Provider,
  messages: ProviderMessage[],
  sessionId: string,
  callbacks: QueryCallbacks
): Promise<{ messages: ProviderMessage[]; totalUsage: TokenUsage }> {
  const settings = loadSettings();
  const cwd = process.cwd();
  const toolContext: ToolContext = { cwd };

  const gitBranch = await getGitBranch(cwd);
  const projectFiles = getTopLevelFiles(cwd);
  const contextSession = loadContextSession(cwd);

  const systemPrompt = buildSystemPrompt({
    mode: settings.responseMode,
    cwd,
    contextSession: contextSession || undefined,
    projectFiles,
    gitBranch: gitBranch || undefined,
  });

  const tools = getToolsForProvider();
  const totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let loopCount = 0;
  const maxLoops = 50;

  while (loopCount < maxLoops) {
    loopCount++;

    let responseText = "";
    const pendingToolCalls: PendingToolCall[] = [];
    let stopReason: "end_turn" | "tool_use" | "max_tokens" | "error" = "end_turn";

    try {
      const stream = provider.stream(messages, tools, {
        model: settings.model,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        systemPrompt,
        maxTokens: Math.min(provider.config.models.find((m) => m.id === settings.model)?.maxOutput || 8192, 16000),
      });

      for await (const chunk of stream) {
        switch (chunk.type) {
          case "text":
            responseText += chunk.text || "";
            callbacks.onText(chunk.text || "");
            break;

          case "tool_call_start":
            if (chunk.toolCall) {
              pendingToolCalls.push({
                id: chunk.toolCall.id,
                name: chunk.toolCall.name,
                arguments: "",
              });
            }
            break;

          case "tool_call_delta":
            if (chunk.toolCall) {
              const pending = pendingToolCalls.find((tc) => tc.id === chunk.toolCall!.id);
              if (pending) {
                pending.arguments += chunk.toolCall.arguments;
              }
            }
            break;

          case "tool_call_end":
            if (chunk.toolCall) {
              const pending = pendingToolCalls.find((tc) => tc.id === chunk.toolCall!.id);
              if (pending) {
                pending.arguments = chunk.toolCall.arguments;
              }
              stopReason = "tool_use";
            }
            break;

          case "done":
            if (chunk.usage) {
              totalUsage.inputTokens += chunk.usage.inputTokens;
              totalUsage.outputTokens += chunk.usage.outputTokens;
              if (chunk.usage.cacheReadTokens) {
                totalUsage.cacheReadTokens =
                  (totalUsage.cacheReadTokens || 0) + chunk.usage.cacheReadTokens;
              }
            }
            break;

          case "error":
            callbacks.onError(chunk.error || "Unknown error");
            return { messages, totalUsage };
        }
      }
    } catch (err: any) {
      callbacks.onError(err.message || "Stream failed");
      return { messages, totalUsage };
    }

    const assistantMessage: ProviderMessage = {
      role: "assistant",
      content: responseText,
    };

    if (pendingToolCalls.length > 0) {
      assistantMessage.tool_calls = pendingToolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      }));
    }

    messages.push(assistantMessage);
    appendMessage(sessionId, assistantMessage);

    if (pendingToolCalls.length === 0 || stopReason !== "tool_use") {
      callbacks.onDone(totalUsage);
      break;
    }

    const toolResults = await Promise.all(
      pendingToolCalls.map(async (tc) => {
        const tool = getTool(tc.name);
        if (!tool) {
          return {
            id: tc.id,
            output: "",
            error: `Unknown tool: ${tc.name}`,
          };
        }

        let input: Record<string, unknown>;
        try {
          input = JSON.parse(tc.arguments);
        } catch {
          return {
            id: tc.id,
            output: "",
            error: `Invalid JSON arguments for ${tc.name}`,
          };
        }

        if (isDenied(tc.name)) {
          callbacks.onToolEnd(tc.name, tc.id, "", `Tool "${tc.name}" is denied by permission rules.`);
          return {
            id: tc.id,
            output: "",
            error: `Tool "${tc.name}" is blocked by permission rules. The user has denied this tool.`,
          };
        }

        if (shouldPrompt(tc.name)) {
          callbacks.onToolStart(tc.name, tc.id);
          const allowed = await callbacks.onToolPermission(tc.name, input);
          if (!allowed) {
            callbacks.onToolEnd(tc.name, tc.id, "", "User denied permission.");
            return {
              id: tc.id,
              output: "",
              error: "User denied permission for this tool execution.",
            };
          }
        } else {
          callbacks.onToolStart(tc.name, tc.id);
        }

        const result = await tool.execute(input, toolContext);
        callbacks.onToolEnd(tc.name, tc.id, result.output, result.error);
        return { id: tc.id, ...result };
      })
    );

    for (const result of toolResults) {
      const toolMessage: ProviderMessage = {
        role: "tool",
        content: result.error
          ? `Error: ${result.error}\n${result.output}`
          : result.output,
        tool_call_id: result.id,
      };
      messages.push(toolMessage);
      appendMessage(sessionId, toolMessage);
    }
  }

  if (loopCount >= maxLoops) {
    callbacks.onError("Maximum tool loop iterations reached (50). Stopping.");
  }

  const lastAssistant = messages
    .filter((m) => m.role === "assistant" && typeof m.content === "string")
    .pop();
  if (lastAssistant && typeof lastAssistant.content === "string") {
    const summary = lastAssistant.content.slice(0, 500);
    updateContextSession(cwd, summary);
  }

  return { messages, totalUsage };
}

export { describeToolCall };
