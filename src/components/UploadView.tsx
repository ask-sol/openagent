import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  pickFileMac,
  startShareSession,
  formatShareSummary,
  type ShareSession,
} from "../utils/fileShare.js";

interface UploadViewProps {
  onClose: () => void;
}

type Step = "picking" | "linux-prompt" | "starting" | "active" | "done" | "error";

export function UploadView({ onClose }: UploadViewProps) {
  const isMac = process.platform === "darwin";
  const [step, setStep] = useState<Step>(isMac ? "picking" : "linux-prompt");
  const [pathInput, setPathInput] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<ShareSession | null>(null);
  const [doneMessage, setDoneMessage] = useState("");
  const sessionRef = useRef<ShareSession | null>(null);

  useInput((_, key) => {
    if (!key.escape) return;
    sessionRef.current?.stop();
    onClose();
  });

  // macOS: open Finder picker on mount
  useEffect(() => {
    if (step !== "picking" || !isMac) return;
    let cancelled = false;
    (async () => {
      try {
        const picked = await pickFileMac();
        if (cancelled) return;
        if (!picked) {
          setError("No file selected.");
          setStep("error");
          return;
        }
        await launchSession(picked);
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message || "Picker failed.");
        setStep("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, isMac]);

  async function launchSession(filePath: string) {
    setStep("starting");
    try {
      const s = await startShareSession(filePath);
      sessionRef.current = s;
      setSession(s);
      setStep("active");
      s.done.then((info) => {
        setDoneMessage(
          `✓ Downloaded by ${info.downloadedBy} at ${info.at.toLocaleTimeString()}. Server stopped.`,
        );
        setStep("done");
        setTimeout(onClose, 2500);
      });
    } catch (err: any) {
      setError(err.message || "Failed to start share server.");
      setStep("error");
    }
  }

  if (step === "picking") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color="cyan"><Spinner type="dots" /> Opening Finder…</Text>
        <Text dimColor>Pick a file to share over your local network.</Text>
        <Text dimColor>Esc to cancel.</Text>
      </Box>
    );
  }

  if (step === "linux-prompt") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Share a file over LAN</Text>
        <Text dimColor>Enter the absolute path to the file you want to share.</Text>
        <Text dimColor>Tab-completion isn't available; copy the full path.</Text>
        <Text> </Text>
        {error && <Text color="red">{error}</Text>}
        <Box>
          <Text color="cyan">{"❯ "}</Text>
          <TextInput
            value={pathInput}
            onChange={setPathInput}
            onSubmit={async () => {
              const raw = pathInput.trim();
              if (!raw) return;
              const full = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
              if (!existsSync(full)) {
                setError(`File not found: ${full}`);
                return;
              }
              setError("");
              await launchSession(full);
            }}
            placeholder="/home/user/file.pdf"
          />
        </Box>
        <Text> </Text>
        <Text dimColor>Esc to cancel.</Text>
      </Box>
    );
  }

  if (step === "starting") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color="cyan"><Spinner type="dots" /> Starting share server…</Text>
      </Box>
    );
  }

  if (step === "active" && session) {
    return (
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>{formatShareSummary(session)}</Text>
      </Box>
    );
  }

  if (step === "done" && session) {
    return (
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text color="green">{doneMessage}</Text>
        <Text dimColor>{session.fileName} ({session.url})</Text>
      </Box>
    );
  }

  if (step === "error") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color="red">✗ {error}</Text>
        <Text dimColor>Esc to close.</Text>
      </Box>
    );
  }

  return null;
}
