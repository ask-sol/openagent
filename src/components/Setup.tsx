import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import { loadSettings, saveSettings } from "../config/settings.js";
import type { OpenAgentSettings, ResponseMode } from "../config/settings.js";
import { getBanner, getTerminalSize } from "../utils/terminal.js";
import { detectProject, formatProjectInfo } from "../utils/projectDetect.js";
import { getProvider } from "../providers/index.js";
import { ModelPicker } from "./ModelPicker.js";

type SetupStep = "welcome" | "model" | "response_mode" | "done";

interface SetupProps {
  onComplete: (settings: OpenAgentSettings) => void;
}

export function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState<SetupStep>("welcome");
  const { columns } = getTerminalSize();
  const project = detectProject(process.cwd());

  useEffect(() => {
    if (step !== "welcome") return;
    const timer = setTimeout(() => setStep("model"), 1500);
    return () => clearTimeout(timer);
  }, [step]);

  const handleModelComplete = (providerId: string, modelId: string) => {
    setStep("response_mode");
  };

  const handleResponseMode = (item: { value: string }) => {
    const settings = loadSettings();
    settings.responseMode = item.value as ResponseMode;
    settings.setupComplete = true;
    saveSettings(settings);
    setStep("done");

    const provider = getProvider(settings.provider);
    const modelName = provider?.config.models.find(m => m.id === settings.model)?.name || settings.model;

    setTimeout(() => onComplete(settings), 400);
  };

  if (step === "welcome") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>{getBanner(columns)}</Text>
        <Text> </Text>
        <Text bold color="white">Welcome to OpenAgent</Text>
        <Text color="gray">Open-source agentic coding, right in your terminal.</Text>
        <Text> </Text>
        <Box flexDirection="column" marginLeft={2}>
          <Text color="gray">{"•"} 10 providers — OpenAI, Anthropic, Gemini, Ollama, and more</Text>
          <Text color="gray">{"•"} Run models locally or in the cloud</Text>
          <Text color="gray">{"•"} 70+ commands, web search, social media, MCP servers</Text>
        </Box>
        <Text> </Text>
        {project && (
          <Text color="gray">Detected: <Text color="cyan">{formatProjectInfo(project)}</Text></Text>
        )}
        <Text> </Text>
        <Text color="cyan"><Spinner type="dots" /> Starting setup...</Text>
      </Box>
    );
  }

  if (step === "model") {
    return (
      <Box flexDirection="column" padding={1}>
        <ModelPicker onComplete={handleModelComplete} onCancel={() => {}} />
      </Box>
    );
  }

  if (step === "response_mode") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="white">Response style</Text>
        <Text> </Text>
        <SelectInput
          items={[
            { label: "Concise     No filler, gets to work immediately  ← recommended", value: "concise" },
            { label: "Explanative Brief explanations alongside actions", value: "explanative" },
          ]}
          onSelect={handleResponseMode}
        />
        <Text> </Text>
        <Text dimColor>Both write full production code. Only conversation changes.</Text>
      </Box>
    );
  }

  if (step === "done") {
    return (
      <Box padding={1}>
        <Text color="green" bold>{"✓"} Ready</Text>
      </Box>
    );
  }

  return null;
}
