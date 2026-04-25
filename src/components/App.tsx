import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { Setup } from "./Setup.js";
import { REPL } from "./REPL.js";
import { loadSettings, type OpenAgentSettings } from "../config/settings.js";
import { getTerminalSize, onResize } from "../utils/terminal.js";
import { connectAllMcpServers, disconnectAllMcpServers } from "../mcp/client.js";

interface AppProps {
  forceSetup?: boolean;
  thinkingEnabled?: boolean;
}

export function App({ forceSetup, thinkingEnabled }: AppProps) {
  const [settings, setSettings] = useState<OpenAgentSettings | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [termSize, setTermSize] = useState(getTerminalSize());

  useEffect(() => {
    return onResize(setTermSize);
  }, []);

  useEffect(() => {
    const current = loadSettings();
    if (forceSetup || !current.setupComplete) {
      setNeedsSetup(true);
    } else {
      setSettings(current);
    }
  }, [forceSetup]);

  // Connect MCP servers on launch (if any are configured) and clean up on exit.
  useEffect(() => {
    let cancelled = false;
    connectAllMcpServers().catch(() => {
      // Connection failures are surfaced via /mcp-status; we don't block startup.
    });
    return () => {
      if (cancelled) return;
      cancelled = true;
      disconnectAllMcpServers().catch(() => {});
    };
  }, []);

  const handleSetupComplete = (newSettings: OpenAgentSettings) => {
    setSettings(newSettings);
    setNeedsSetup(false);
  };

  if (needsSetup) {
    return <Setup onComplete={handleSetupComplete} />;
  }

  if (!settings) {
    return (
      <Box padding={1}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  return <REPL settings={settings} thinkingEnabled={thinkingEnabled || false} />;
}
