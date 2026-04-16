import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { useStatusWord } from "../utils/statusWords.js";
import { getProvider } from "../providers/index.js";
import { loadSettings, saveSettings, type OpenAgentSettings } from "../config/settings.js";
import { getEffectiveMode, getModeMeta } from "../config/permissions.js";
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
  const [pickerView, setPickerView] = useState<"none" | "provider" | "model">("none");
  const [permissionPrompt, setPermissionPrompt] = useState<{ name: string; desc: string } | null>(null);
  const permissionResolveRef = useRef<((allowed: boolean) => void) | null>(null);

  const messagesRef = useRef<ProviderMessage[]>([]);
  const streamingTextRef = useRef("");
  const messageCountRef = useRef(0);
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
    if (key.ctrl && ch === "c") {
      if (permissionPrompt && permissionResolveRef.current) {
        permissionResolveRef.current(false);
        permissionResolveRef.current = null;
        setPermissionPrompt(null);
        return;
      }
      exit();
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
        const { addRule } = require("../config/permissions.js");
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

  const permMode = useMemo(() => {
    const mode = getEffectiveMode();
    return getModeMeta(mode);
  }, []);

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setInput("");

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

        if (result.output) {
          setDisplayMessages((prev) => [...prev, { role: "system", content: result.output }]);
        }
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

      const callbacks: QueryCallbacks = {
        onText: (text) => {
          streamingTextRef.current += text;
          setStreamingText(streamingTextRef.current);
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
        onToolEnd: (name, _id, result, err) => {
          setActiveTool("");
          let displayContent = "";
          let meta = "";

          if (name === "FileEdit") {
            try {
              const parsed = result.match(/Edited (.+?) —/);
              if (parsed) {
                meta = `Update(${parsed[1].split("/").pop()})`;
                displayContent = result;
              }
            } catch {}
          } else if (name === "FileWrite") {
            try {
              const parsed = result.match(/(Created|Overwrote) (.+?) \((\d+) lines\)/);
              if (parsed) {
                meta = `${parsed[1] === "Created" ? "Create" : "Write"}(${parsed[2].split("/").pop()})`;
                displayContent = result;
              }
            } catch {}
          } else if (name === "FileRead") {
            try {
              const parsed = result.match(/File: (.+?) \((\d+) lines\)/);
              if (parsed) {
                meta = `Read(${parsed[1].split("/").pop()})`;
                const lines = result.split("\n");
                displayContent = lines.length > 10 ? lines.slice(0, 10).join("\n") + `\n  ... ${lines.length - 10} more lines` : result;
              }
            } catch {}
          } else if (name === "Bash") {
            meta = "Bash";
            const lines = result.split("\n");
            displayContent = lines.length > 15 ? lines.slice(0, 15).join("\n") + `\n  ... ${lines.length - 15} more lines` : result;
          } else if (name === "Glob") {
            meta = "Glob";
            displayContent = result.length > 300 ? result.slice(0, 300) + "..." : result;
          } else if (name === "Grep") {
            meta = "Grep";
            displayContent = result.length > 300 ? result.slice(0, 300) + "..." : result;
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
          }));
        },
        onError: (err) => {
          setError(err);
        },
      };

      try {
        const result = await runQueryLoop(provider, messagesRef.current, sessionId, callbacks, thinking);
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

      setStreamingText("");
      streamingTextRef.current = "";
      setIsProcessing(false);
    },
    [settings, sessionId, exit, thinking, tokenUsage]
  );

  const renderMessage = (msg: MessageDisplay, idx: number) => {
    const width = Math.max(termSize.columns - 4, 40);

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
              <Text>{wrapText(msg.content, width - 2)}</Text>
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

  return (
    <Box flexDirection="column" width={termSize.columns}>
      {displayMessages.length === 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text>{getBanner(termSize.columns)}</Text>
          <Text color="gray">
            {modelDisplay} • {settings.responseMode} mode • {permMode.label} [{permMode.symbol}]
            {thinking ? " • thinking" : ""}
          </Text>
          <Text color="gray" dimColor>Type /help for commands, or start typing to chat</Text>
          <Text> </Text>
        </Box>
      )}

      <Box flexDirection="column" flexGrow={1}>
        {displayMessages.map(renderMessage)}
      </Box>

      {streamingText && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="green" bold>{"⏺"} OpenAgent — <Text color="gray">{modelDisplay}</Text></Text>
          <Box marginLeft={2}>
            <Text>{wrapText(streamingText, Math.max(termSize.columns - 6, 40))}</Text>
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
        <Box borderStyle="single" borderColor="gray" paddingLeft={1} width={termSize.columns}>
          <Box flexGrow={1}>
            {isProcessing ? (
              <Text color="cyan">
                <Spinner type="dots" /> <Text color="white">{statusWord}</Text><Text color="gray">...</Text>
              </Text>
            ) : (
              <Box>
                <Text color="cyan" bold>{"❯"} </Text>
                <TextInput
                  value={input}
                  onChange={setInput}
                  onSubmit={handleSubmit}
                  placeholder="Message OpenAgent..."
                />
              </Box>
            )}
          </Box>
        </Box>
      )}

      <Box paddingLeft={1}>
        <Text dimColor>
          {permMode.label} [{permMode.symbol}]
          {thinking ? " • think" : ""}
          {" • "}{formatTokens(tokenUsage.inputTokens + tokenUsage.outputTokens)} tokens
          {" • "}{modelDisplay}
        </Text>
      </Box>
    </Box>
  );
}
