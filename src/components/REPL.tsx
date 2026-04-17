import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { useStatusWord } from "../utils/statusWords.js";
import { getProvider } from "../providers/index.js";
import { loadSettings, saveSettings, type OpenAgentSettings } from "../config/settings.js";
import { getEffectiveMode, getModeMeta, addRule, loadPermissions, savePermissions } from "../config/permissions.js";
import { runQueryLoop, describeToolCall, type QueryCallbacks } from "../query.js";
import {
  createSession,
  appendMessage,
  listSessions,
  loadSession,
  type SessionMeta,
} from "../session/history.js";
import { executeCommand, getCommand, getAllCommands, type CommandContext, type CommandResult } from "../commands/index.js";
import type { ProviderMessage, TokenUsage } from "../providers/types.js";
import {
  getBanner,
  getTerminalSize,
  onResize,
  formatTokens,
  wrapText,
} from "../utils/terminal.js";
import { ProviderPicker } from "./ProviderPicker.js";
import { ModelPicker } from "./ModelPicker.js";
import { RedditSetup } from "./RedditSetup.js";
import { XSetup } from "./XSetup.js";
import { WhatsAppSetup } from "./WhatsAppSetup.js";
import { DiscordSetup } from "./DiscordSetup.js";
import { detectProject, formatProjectInfo } from "../utils/projectDetect.js";
import { estimateCost } from "../utils/costTracker.js";
import { renderMarkdown } from "../utils/renderMarkdown.js";
import { getContextMeter } from "../utils/contextMeter.js";

interface MessageDisplay {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolName?: string;
  toolError?: boolean;
  toolMeta?: string;
}

interface REPLProps {
  settings: OpenAgentSettings;
  thinkingEnabled: boolean;
}

export function REPL({ settings: initialSettings, thinkingEnabled: initialThinking }: REPLProps) {
  const [input, setInput] = useState("");
  const [displayMessages, setDisplayMessages] = useState<MessageDisplay[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeTool, setActiveTool] = useState("");
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ inputTokens: 0, outputTokens: 0 });
  const [termSize, setTermSize] = useState(getTerminalSize());
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const [thinking, setThinking] = useState(initialThinking);
  const [settings, setSettings] = useState(initialSettings);
  const [pickerView, setPickerView] = useState<"none" | "provider" | "model" | "reddit" | "x" | "whatsapp" | "discord">("none");
  const [permissionPrompt, setPermissionPrompt] = useState<{ name: string; desc: string } | null>(null);
  const permissionResolveRef = useRef<((allowed: boolean) => void) | null>(null);

  const messagesRef = useRef<ProviderMessage[]>([]);
  const streamingTextRef = useRef("");
  const streamThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageCountRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [queuedMessages, setQueuedMessages] = useState<string[]>([]);
  const [expandedView, setExpandedView] = useState(false);
  const [terminalMode, setTerminalMode] = useState(false);
  const { exit } = useApp();
  const { stdout } = useStdout();
  const statusWord = useStatusWord(isProcessing);

  useEffect(() => {
    const session = createSession(process.cwd(), settings.provider, settings.model);
    setSessionId(session.id);
  }, []);

  useEffect(() => {
    return onResize((size) => setTermSize(size));
  }, []);

  useInput((ch, key) => {
    if (key.ctrl && ch === "b") {
      setExpandedView((prev) => !prev);
      return;
    }

    if (key.ctrl && ch === "t") {
      setTerminalMode((prev) => !prev);
      return;
    }

    if (key.shift && key.tab) {
      const state = loadPermissions();
      const modes: Array<"standard" | "cautious" | "unrestricted"> = ["standard", "cautious", "unrestricted"];
      const idx = modes.indexOf(state.mode);
      state.mode = modes[(idx + 1) % modes.length];
      savePermissions(state);
      setPermModeKey((k: number) => k + 1);
      setDisplayMessages((prev: any) => [...prev, { role: "system", content: `Mode: ${state.mode}` }]);
      return;
    }

    if (key.ctrl && ch === "c") {
      if (permissionPrompt && permissionResolveRef.current) {
        permissionResolveRef.current(false);
        permissionResolveRef.current = null;
        setPermissionPrompt(null);
        return;
      }
      if (isProcessing && abortRef.current) {
        abortRef.current.abort();
        return;
      }
      exit();
      return;
    }

    if (key.escape) {
      if (isProcessing && abortRef.current) {
        abortRef.current.abort();
        setDisplayMessages((prev) => [
          ...prev,
          { role: "system", content: "Interrupted." },
        ]);
        return;
      }
    }

    if (key.escape && key.shift && isProcessing && input.trim()) {
      setQueuedMessages((prev) => [...prev, input.trim()]);
      setDisplayMessages((prev) => [
        ...prev,
        { role: "system", content: `Queued: ${input.trim()}` },
      ]);
      setInput("");
      return;
    }

    if (permissionPrompt && permissionResolveRef.current) {
      const c = ch.toLowerCase();
      if (c === "y" || key.return) {
        const resolve = permissionResolveRef.current;
        permissionResolveRef.current = null;
        setPermissionPrompt(null);
        resolve(true);
      } else if (c === "n") {
        const resolve = permissionResolveRef.current;
        permissionResolveRef.current = null;
        setPermissionPrompt(null);
        resolve(false);
      } else if (c === "a") {
        addRule({ tool: permissionPrompt.name, behavior: "allow" }, "global");
        const resolve = permissionResolveRef.current;
        permissionResolveRef.current = null;
        setPermissionPrompt(null);
        resolve(true);
      }
    }
  });

  const commandHint = useMemo(() => {
    if (!input.startsWith("/") || input.includes(" ")) return "";
    const partial = input.slice(1).toLowerCase();
    if (!partial) return "";
    const allCmds = getAllCommands();
    const matches = allCmds.filter(
      (c) => c.name.startsWith(partial) || c.aliases.some((a) => a.startsWith(partial))
    );
    if (matches.length === 0) return "";
    if (matches.length <= 5) {
      return matches.map((m) => `/${m.name}`).join("  ");
    }
    return matches.slice(0, 5).map((m) => `/${m.name}`).join("  ") + `  +${matches.length - 5} more`;
  }, [input]);

  const [permModeKey, setPermModeKey] = useState(0);
  const permMode = useMemo(() => {
    const mode = getEffectiveMode();
    return { ...getModeMeta(mode), mode };
  }, [permModeKey]);

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setInput("");

      if (terminalMode) {
        setDisplayMessages((prev) => [
          ...prev,
          { role: "system", content: `\x1b[33m$\x1b[0m ${trimmed}` },
        ]);
        setIsProcessing(true);
        const { spawn: spawnCmd } = await import("node:child_process");
        const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [trimmed];
        const cmd = parts[0];
        const args = parts.slice(1).map((a: string) => a.replace(/^"|"$/g, ""));
        const proc = spawnCmd(cmd, args, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], shell: true });
        let output = "";
        proc.stdout?.on("data", (d: Buffer) => { output += d.toString(); });
        proc.stderr?.on("data", (d: Buffer) => { output += d.toString(); });
        proc.on("close", (code) => {
          setDisplayMessages((prev) => [
            ...prev,
            { role: "system", content: output.trim() || (code ? `Exit code ${code}` : "(no output)") },
          ]);
          setIsProcessing(false);
        });
        abortRef.current = new AbortController();
        abortRef.current.signal.addEventListener("abort", () => { proc.kill(); });
        return;
      }

      if (trimmed.startsWith("/")) {
        if (trimmed === "/think" || trimmed === "/thinking") {
          setThinking((prev) => !prev);
          setDisplayMessages((prev) => [
            ...prev,
            { role: "system", content: `Thinking mode: ${!thinking ? "enabled" : "disabled"}` },
          ]);
          return;
        }

        const cmdCtx: CommandContext = {
          cwd: process.cwd(),
          tokenUsage,
          sessionId,
          messageCount: messageCountRef.current,
        };

        const result = await executeCommand(trimmed, cmdCtx);

        if (result.action === "exit") {
          exit();
          return;
        }

        if (result.action === "clear") {
          setDisplayMessages([]);
          messagesRef.current = [];
          setStreamingText("");
          setTokenUsage({ inputTokens: 0, outputTokens: 0 });
          messageCountRef.current = 0;
          return;
        }

        if (result.action === "resume" && result.data) {
          const loaded = loadSession(result.data.id);
          if (loaded) {
            messagesRef.current = loaded.messages;
            setSessionId(loaded.meta.id);
            messageCountRef.current = loaded.messages.length;
            setDisplayMessages(
              loaded.messages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m) => ({
                  role: m.role as "user" | "assistant",
                  content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
                }))
            );
          }
          return;
        }

        if (result.action === "pick-provider") {
          setPickerView("provider");
          return;
        }

        if (result.action === "pick-model") {
          setPickerView("model");
          return;
        }

        if (result.action === "setup-reddit") {
          setPickerView("reddit");
          return;
        }

        if (result.action === "setup-x") {
          setPickerView("x");
          return;
        }

        if ((result.action as string) === "setup-whatsapp") {
          setPickerView("whatsapp");
          return;
        }

        if ((result.action as string) === "setup-discord") {
          setPickerView("discord");
          return;
        }

        if (result.action === "compact") {
          const msgCount = messagesRef.current.length;
          if (msgCount < 2) {
            setDisplayMessages((prev) => [...prev, { role: "system", content: "Nothing to compact." }]);
            return;
          }

          const summaryParts: string[] = [];
          for (const m of messagesRef.current) {
            if (m.role === "user" && typeof m.content === "string") {
              summaryParts.push(`User asked: ${m.content.slice(0, 100)}`);
            }
            if (m.role === "assistant" && typeof m.content === "string" && m.content.length > 0) {
              summaryParts.push(`Agent: ${m.content.slice(0, 150)}`);
            }
          }
          const summary = summaryParts.slice(-10).join("\n");

          messagesRef.current = [
            { role: "user", content: `[Compacted session summary]\n${summary}` },
            { role: "assistant", content: "Understood. I have the context from our previous conversation. What's next?" },
          ];
          messageCountRef.current = 2;

          setDisplayMessages([
            { role: "system", content: `Compacted ${msgCount} messages → 2. Context preserved.` },
          ]);
          setTokenUsage({ inputTokens: 0, outputTokens: 0 });
          return;
        }

        if (result.output) {
          setDisplayMessages((prev) => [...prev, { role: "system", content: result.output }]);
        }
        setPermModeKey((k) => k + 1);
        return;
      }

      setDisplayMessages((prev) => [...prev, { role: "user", content: trimmed }]);

      const userMessage: ProviderMessage = { role: "user", content: trimmed };
      messagesRef.current.push(userMessage);
      messageCountRef.current++;
      appendMessage(sessionId, userMessage);

      const provider = getProvider(settings.provider);
      if (!provider) {
        setError(`Provider "${settings.provider}" not found`);
        return;
      }

      setIsProcessing(true);
      setStreamingText("");
      streamingTextRef.current = "";
      setActiveTool("");
      setError("");
      const abortController = new AbortController();
      abortRef.current = abortController;

      const callbacks: QueryCallbacks = {
        onText: (text) => {
          streamingTextRef.current += text;
          if (!streamThrottleRef.current) {
            streamThrottleRef.current = setTimeout(() => {
              setStreamingText(streamingTextRef.current);
              streamThrottleRef.current = null;
            }, 150);
          }
        },
        onToolStart: (name) => {
          setActiveTool(name);
        },
        onToolPermission: async (name, args) => {
          const desc = describeToolCall(name, args);
          setActiveTool("");
          setPermissionPrompt({ name, desc });
          return new Promise<boolean>((resolve) => {
            permissionResolveRef.current = resolve;
          });
        },
        onToolEnd: (name, _id, result, err, args) => {
          setActiveTool("");
          let displayContent = "";
          let meta = "";

          if (name === "FileEdit") {
            const parsed = result.match(/Edited (.+?) —/);
            const fileName = parsed ? parsed[1].split("/").pop() : "";
            meta = `Update(${fileName})`;
            const lines = result.split("\n");
            displayContent = lines.map((l: string) => {
              if (l.startsWith("+ ")) return `\x1b[32m${l}\x1b[0m`;
              if (l.startsWith("- ")) return `\x1b[31m${l}\x1b[0m`;
              return l;
            }).slice(0, 20).join("\n");
          } else if (name === "FileWrite") {
            const parsed = result.match(/(Created|Overwrote) (.+?) \((\d+) lines\)/);
            const fileName = parsed ? parsed[2].split("/").pop() : "";
            meta = `${parsed?.[1] === "Created" ? "\x1b[32mCreate\x1b[0m" : "Write"}(${fileName})`;
            const lines = result.split("\n");
            displayContent = lines.slice(0, 12).join("\n");
            if (lines.length > 12) displayContent += `\n  ... ${lines.length - 12} more`;
          } else if (name === "FileRead") {
            const parsed = result.match(/File: (.+?) \((\d+) lines\)/);
            meta = `Read(${parsed ? parsed[1].split("/").pop() : ""})`;
            const lines = result.split("\n");
            displayContent = lines.slice(0, 8).join("\n");
            if (lines.length > 8) displayContent += `\n  ... ${lines.length - 8} more lines`;
          } else if (name === "Bash") {
            const cmd = (args?.command as string) || "";
            const cmdPreview = cmd.length > 60 ? cmd.slice(0, 57) + "..." : cmd;
            meta = `Bash(${cmdPreview})`;
            const lines = result.split("\n");
            displayContent = lines.slice(0, 12).join("\n");
            if (lines.length > 12) displayContent += `\n  ... ${lines.length - 12} more lines`;
          } else if (name === "Glob") {
            meta = "Glob";
            displayContent = result.length > 300 ? result.slice(0, 300) + "..." : result;
          } else if (name === "Grep") {
            meta = "Grep";
            displayContent = result.length > 300 ? result.slice(0, 300) + "..." : result;
          } else if (name === "WebSearch") {
            meta = "\x1b[36mWebSearch\x1b[0m";
            displayContent = result.length > 400 ? result.slice(0, 400) + "..." : result;
          } else {
            meta = name;
            displayContent = result.length > 500 ? result.slice(0, 500) + "..." : result;
          }

          if (!displayContent) displayContent = result.length > 500 ? result.slice(0, 500) + "..." : result;
          if (!meta) meta = name;

          setDisplayMessages((prev) => [
            ...prev,
            {
              role: "tool",
              content: err ? `Error: ${err}\n${displayContent}` : displayContent,
              toolName: name,
              toolMeta: meta,
              toolError: !!err,
            },
          ]);
        },
        onDone: (usage) => {
          setTokenUsage((prev) => ({
            inputTokens: prev.inputTokens + usage.inputTokens,
            outputTokens: prev.outputTokens + usage.outputTokens,
            cacheReadTokens: (prev.cacheReadTokens || 0) + (usage.cacheReadTokens || 0),
            costUsd: usage.costUsd ? (prev.costUsd || 0) + usage.costUsd : prev.costUsd,
          }));
        },
        onError: (err) => {
          setError(err);
        },
      };

      try {
        const result = await runQueryLoop(provider, messagesRef.current, sessionId, callbacks, thinking, abortController.signal);
        messagesRef.current = result.messages;
        messageCountRef.current = result.messages.length;

        if (streamingTextRef.current) {
          let finalText = streamingTextRef.current;
          const thinkMatch = finalText.match(/<think>([\s\S]*?)<\/think>/);
          if (thinkMatch) {
            const thinkContent = thinkMatch[1].trim();
            finalText = finalText.replace(/<think>[\s\S]*?<\/think>/, "").trim();
            if (thinkContent) {
              setDisplayMessages((prev) => [
                ...prev,
                { role: "system", content: `[thinking] ${thinkContent}` },
              ]);
            }
          }
          if (finalText) {
            setDisplayMessages((prev) => [
              ...prev,
              { role: "assistant", content: finalText },
            ]);
          }
        }
      } catch (err: any) {
        setError(err.message);
      }

      if (streamThrottleRef.current) {
        clearTimeout(streamThrottleRef.current);
        streamThrottleRef.current = null;
      }
      setStreamingText("");
      streamingTextRef.current = "";
      abortRef.current = null;
      setIsProcessing(false);

      setQueuedMessages((prev) => {
        if (prev.length > 0) {
          const [next, ...rest] = prev;
          setTimeout(() => handleSubmit(next), 100);
          return rest;
        }
        return prev;
      });
    },
    [settings, sessionId, exit, thinking, tokenUsage, terminalMode]
  );

  const renderMessage = (msg: MessageDisplay, idx: number) => {
    const width = Math.max(termSize.columns - 4, 40);
    const totalMsgs = displayMessages.length;
    const isOld = !expandedView && totalMsgs > 6 && idx < totalMsgs - 4;

    if (isOld) {
      if (idx === 0) {
        const hiddenCount = totalMsgs - 4;
        return (
          <Box key={idx} marginBottom={1} marginLeft={2}>
            <Text dimColor color="gray">
              ··· {hiddenCount} earlier messages hidden — Ctrl+B to expand ···
            </Text>
          </Box>
        );
      }
      return null;
    }

    switch (msg.role) {
      case "user":
        return (
          <Box key={idx} flexDirection="column" marginBottom={1}>
            <Text color="blue" bold>{"❯"} You</Text>
            <Box marginLeft={2}>
              <Text>{wrapText(msg.content, width - 2)}</Text>
            </Box>
          </Box>
        );

      case "assistant":
        return (
          <Box key={idx} flexDirection="column" marginBottom={1}>
            <Text color="green" bold>{"⏺"} OpenAgent — <Text color="gray">{modelDisplay}</Text></Text>
            <Box marginLeft={2}>
              <Text>{renderMarkdown(wrapText(msg.content, width - 2))}</Text>
            </Box>
          </Box>
        );

      case "tool":
        return (
          <Box key={idx} flexDirection="column" marginBottom={1}>
            <Text color={msg.toolError ? "red" : "yellow"}>
              {"  ⎿ "}{msg.toolMeta || msg.toolName}{msg.toolError ? " FAILED" : ""}
            </Text>
            {msg.content && (
              <Box marginLeft={4} flexDirection="column">
                <Text dimColor>{wrapText(msg.content, width - 6)}</Text>
              </Box>
            )}
          </Box>
        );

      case "system":
        return (
          <Box key={idx} marginBottom={1} marginLeft={2}>
            <Text color="gray">{wrapText(msg.content, width - 2)}</Text>
          </Box>
        );
    }
  };

  const modelDisplay = useMemo(() => {
    const provider = getProvider(settings.provider);
    if (provider) {
      const model = provider.config.models.find((m) => m.id === settings.model);
      if (model) return model.name;
    }
    const parts = settings.model.split("/");
    return parts[parts.length - 1];
  }, [settings.provider, settings.model]);

  const handlePickerComplete = (providerId: string, modelId: string) => {
    const updated = loadSettings();
    setSettings(updated);
    setPickerView("none");
    setDisplayMessages((prev) => [
      ...prev,
      { role: "system", content: `Switched to ${providerId}/${modelId}` },
    ]);
  };

  const handlePickerCancel = () => {
    setPickerView("none");
  };

  if (pickerView === "provider") {
    return (
      <Box flexDirection="column" width={termSize.columns}>
        <ProviderPicker onComplete={handlePickerComplete} onCancel={handlePickerCancel} />
      </Box>
    );
  }

  if (pickerView === "model") {
    return (
      <Box flexDirection="column" width={termSize.columns}>
        <ModelPicker onComplete={handlePickerComplete} onCancel={handlePickerCancel} />
      </Box>
    );
  }

  if (pickerView === "reddit") {
    return (
      <Box flexDirection="column" width={termSize.columns}>
        <RedditSetup
          onComplete={(msg) => {
            setPickerView("none");
            setDisplayMessages((prev) => [...prev, { role: "system", content: msg }]);
          }}
          onCancel={handlePickerCancel}
        />
      </Box>
    );
  }

  if (pickerView === "x") {
    return (
      <Box flexDirection="column" width={termSize.columns}>
        <XSetup
          onComplete={(msg) => {
            setPickerView("none");
            setDisplayMessages((prev) => [...prev, { role: "system", content: msg }]);
          }}
          onCancel={handlePickerCancel}
        />
      </Box>
    );
  }

  if (pickerView === "whatsapp") {
    return (
      <Box flexDirection="column" width={termSize.columns}>
        <WhatsAppSetup
          onComplete={(msg) => {
            setPickerView("none");
            setDisplayMessages((prev) => [...prev, { role: "system", content: msg }]);
          }}
          onCancel={handlePickerCancel}
        />
      </Box>
    );
  }

  if (pickerView === "discord") {
    return (
      <Box flexDirection="column" width={termSize.columns}>
        <DiscordSetup
          onComplete={(msg) => {
            setPickerView("none");
            setDisplayMessages((prev) => [...prev, { role: "system", content: msg }]);
          }}
          onCancel={handlePickerCancel}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={termSize.columns}>
      {displayMessages.length === 0 && (() => {
        const project = detectProject(process.cwd());
        return (
          <Box flexDirection="column" marginBottom={1}>
            <Text>{getBanner(termSize.columns)}</Text>
            <Text color="gray">
              {modelDisplay} • {settings.responseMode} mode • {permMode.label} [{permMode.symbol}]
              {thinking ? " • thinking" : ""}
            </Text>
            {project && (
              <Text color="gray" dimColor>
                {formatProjectInfo(project)}
              </Text>
            )}
            <Text color="gray" dimColor>Type /help for commands, or start typing to chat</Text>
            <Text> </Text>
          </Box>
        );
      })()}

      <Box flexDirection="column" flexGrow={1}>
        {displayMessages.map(renderMessage)}
      </Box>

      {isProcessing && !streamingText && !activeTool && !permissionPrompt && (
        <Box marginBottom={1}>
          <Text color="green"><Spinner type="dots" /> </Text>
          <Text color="green" bold>OpenAgent</Text>
          <Text color="gray"> — {modelDisplay}</Text>
        </Box>
      )}

      {streamingText && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="green" bold>{"⏺"} OpenAgent — <Text color="gray">{modelDisplay}</Text></Text>
          <Box marginLeft={2}>
            <Text>{renderMarkdown(wrapText(streamingText, Math.max(termSize.columns - 6, 40)))}</Text>
          </Box>
        </Box>
      )}

      {activeTool && (
        <Box marginBottom={1} marginLeft={2}>
          <Text color="yellow">
            <Spinner type="dots" /> {activeTool}
          </Text>
        </Box>
      )}

      {error && (
        <Box marginBottom={1} marginLeft={2}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {commandHint && !isProcessing && (
        <Box marginLeft={2} marginBottom={0}>
          <Text dimColor>{commandHint}</Text>
        </Box>
      )}

      {permissionPrompt && (
        <Box borderStyle="single" borderColor="yellow" paddingLeft={1} paddingRight={1} width={termSize.columns} flexDirection="column">
          <Box>
            <Text color="yellow" bold>? </Text>
            <Text bold>{permissionPrompt.name}</Text>
            <Text> — {permissionPrompt.desc}</Text>
          </Box>
          <Box>
            <Text dimColor>  Allow? </Text>
            <Text color="green" bold> y</Text><Text dimColor>es </Text>
            <Text color="red" bold> n</Text><Text dimColor>o </Text>
            <Text color="cyan" bold> a</Text><Text dimColor>lways</Text>
          </Box>
        </Box>
      )}

      {!permissionPrompt && (
        <Box borderStyle="single" borderColor={terminalMode ? "magenta" : permMode.mode === "unrestricted" ? "red" : "gray"} paddingLeft={1} width={termSize.columns}>
          <Box flexGrow={1}>
            {isProcessing ? (
              <Text color="cyan">
                <Spinner type="dots" /> <Text color="white">{statusWord}</Text><Text color="gray">...</Text>
              </Text>
            ) : (
              <Box>
                <Text color={terminalMode ? "magenta" : "cyan"} bold>{terminalMode ? "$" : "❯"} </Text>
                <TextInput
                  value={input}
                  onChange={setInput}
                  onSubmit={handleSubmit}
                  placeholder={terminalMode ? "Run a command... (Ctrl+T to switch back)" : "Message OpenAgent... (Ctrl+T for terminal)"}
                />
              </Box>
            )}
          </Box>
        </Box>
      )}

      <Box paddingLeft={1} justifyContent="space-between" width={termSize.columns - 2}>
        <Box>
          {terminalMode ? (
            <Text color="magenta" bold>Terminal Mode</Text>
          ) : permMode.mode === "unrestricted" ? (
            <Text color="red" bold>⚠ Unrestricted [{permMode.symbol}]</Text>
          ) : permMode.mode === "cautious" ? (
            <Text color="yellow">{permMode.label} <Text dimColor>[{permMode.symbol}]</Text></Text>
          ) : (
            <Text color="cyan">{permMode.label} <Text dimColor>[{permMode.symbol}]</Text></Text>
          )}
          {thinking && <Text color="yellow"> • think</Text>}
          {queuedMessages.length > 0 && <Text color="yellow"> • {queuedMessages.length} queued</Text>}
          {!expandedView && displayMessages.length > 6 && <Text dimColor> • Ctrl+B expand</Text>}
          <Text dimColor> • </Text>
          <Text color="white">{formatTokens(tokenUsage.inputTokens + tokenUsage.outputTokens)}</Text>
          <Text dimColor> tokens • </Text>
          <Text color="green">{tokenUsage.costUsd ? `$${tokenUsage.costUsd.toFixed(4)}` : estimateCost(settings.model, tokenUsage).formatted}</Text>
          <Text dimColor> • </Text>
          <Text color="cyan">{modelDisplay}</Text>
        </Box>
        <Text>
          {getContextMeter(
            tokenUsage.inputTokens + tokenUsage.outputTokens,
            (() => {
              const p = getProvider(settings.provider);
              return p?.config.models.find((m) => m.id === settings.model)?.contextWindow || 128000;
            })()
          )}
        </Text>
      </Box>
    </Box>
  );
}
