import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import { getAllProviders, searchProviders, getProvider } from "../providers/index.js";
import { saveSettings } from "../config/settings.js";
import type { OpenAgentSettings, ResponseMode } from "../config/settings.js";
import type { Provider } from "../providers/types.js";
import { getBanner, getTerminalSize } from "../utils/terminal.js";
import { detectProject, formatProjectInfo } from "../utils/projectDetect.js";

type SetupStep =
  | "welcome"
  | "provider_search"
  | "provider_select"
  | "api_key"
  | "validating"
  | "model_select"
  | "response_mode"
  | "summary"
  | "done";

interface SetupProps {
  onComplete: (settings: OpenAgentSettings) => void;
}

export function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState<SetupStep>("welcome");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [responseMode, setResponseMode] = useState<ResponseMode>("concise");
  const [error, setError] = useState("");
  const { columns } = getTerminalSize();
  const project = detectProject(process.cwd());

  useEffect(() => {
    if (step !== "welcome") return;
    const timer = setTimeout(() => setStep("provider_search"), 1500);
    return () => clearTimeout(timer);
  }, [step]);

  const handleProviderSearchSubmit = () => {
    const results = searchQuery ? searchProviders(searchQuery) : getAllProviders();
    if (results.length === 1) {
      selectProvider(results[0]);
    } else {
      setStep("provider_select");
    }
  };

  const selectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setSelectedModel(provider.config.defaultModel);

    if (provider.config.id === "ollama") {
      setApiKey("http://localhost:11434");
      setStep("model_select");
      return;
    }

    const envKey = process.env[provider.config.apiKeyEnvVar];
    if (envKey) {
      setApiKey(envKey);
      setStep("model_select");
    } else {
      setStep("api_key");
    }
  };

  const handleProviderSelect = (item: { value: string }) => {
    const provider = getProvider(item.value);
    if (provider) selectProvider(provider);
  };

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }
    setError("");
    setStep("validating");

    try {
      const valid = await selectedProvider!.validateApiKey(apiKey.trim());
      if (!valid) setError("Validation failed — continuing anyway.");
    } catch {}
    setStep("model_select");
  };

  const handleModelSelect = (item: { value: string }) => {
    setSelectedModel(item.value);
    setStep("response_mode");
  };

  const handleResponseMode = (item: { value: string }) => {
    setResponseMode(item.value as ResponseMode);
    setStep("summary");
  };

  const handleConfirm = () => {
    const settings: OpenAgentSettings = {
      provider: selectedProvider!.config.id,
      model: selectedModel,
      apiKey: apiKey.trim(),
      responseMode,
      setupComplete: true,
    };
    saveSettings(settings);
    setStep("done");
    setTimeout(() => onComplete(settings), 400);
  };

  const filteredProviders = searchQuery
    ? searchProviders(searchQuery)
    : getAllProviders();

  const modelName = selectedProvider?.config.models.find((m) => m.id === selectedModel)?.name || selectedModel;

  return (
    <Box flexDirection="column" padding={1}>
      {step === "welcome" && (
        <Box flexDirection="column">
          <Text>{getBanner(columns)}</Text>
          <Text> </Text>
          <Text bold color="white">Welcome to OpenAgent</Text>
          <Text color="gray">Open-source agentic coding, right in your terminal.</Text>
          <Text> </Text>
          <Box flexDirection="column" marginLeft={2}>
            <Text color="gray">{"•"} Multi-provider — OpenAI, Anthropic, Gemini, and more</Text>
            <Text color="gray">{"•"} Agentic coding — reads, writes, runs, searches, fixes</Text>
            <Text color="gray">{"•"} 70+ commands — git, dev tools, web search, social media</Text>
            <Text color="gray">{"•"} Token efficient — concise mode saves tokens without cutting code quality</Text>
          </Box>
          <Text> </Text>
          {project && (
            <Box>
              <Text color="gray">Detected project: </Text>
              <Text color="cyan">{formatProjectInfo(project)}</Text>
            </Box>
          )}
          <Text> </Text>
          <Text color="cyan"><Spinner type="dots" /> Starting setup...</Text>
        </Box>
      )}

      {step === "provider_search" && (
        <Box flexDirection="column">
          <Text bold color="white">Choose your AI provider</Text>
          <Text color="gray">Type to filter, Enter to see all. <Text color="cyan">OpenRouter</Text> recommended — one key, every model.</Text>
          <Text> </Text>
          <Box>
            <Text color="cyan">{"❯ "}</Text>
            <TextInput
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={handleProviderSearchSubmit}
              placeholder="openrouter, openai, anthropic, gemini..."
            />
          </Box>
        </Box>
      )}

      {step === "provider_select" && (
        <Box flexDirection="column">
          <Text bold color="white">Select provider</Text>
          <Text> </Text>
          <SelectInput
            items={filteredProviders.map((p) => ({
              label: `${p.config.name}  ${p.config.description}`,
              value: p.config.id,
            }))}
            onSelect={handleProviderSelect}
          />
        </Box>
      )}

      {step === "api_key" && selectedProvider && (
        <Box flexDirection="column">
          <Text bold color="white">{selectedProvider.config.name} — API Key</Text>
          <Text color="gray">Get yours at <Text color="cyan">{selectedProvider.config.apiKeyUrl}</Text></Text>
          <Text> </Text>
          {error && <Text color="red">{error}</Text>}
          <Box>
            <Text color="cyan">{"❯ "}</Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleApiKeySubmit}
              mask="*"
            />
          </Box>
        </Box>
      )}

      {step === "validating" && (
        <Box>
          <Text color="cyan"><Spinner type="dots" /> Checking key...</Text>
        </Box>
      )}

      {step === "model_select" && selectedProvider && (
        <Box flexDirection="column">
          <Text bold color="white">Pick your model</Text>
          {error && <Text color="yellow">{error}</Text>}
          <Text> </Text>
          <SelectInput
            items={selectedProvider.config.models.map((m) => ({
              label: `${m.name}  ${Math.round(m.contextWindow / 1000)}k context, ${Math.round(m.maxOutput / 1000)}k max output${m.id === selectedProvider.config.defaultModel ? "  ← recommended" : ""}`,
              value: m.id,
            }))}
            onSelect={handleModelSelect}
            initialIndex={Math.max(selectedProvider.config.models.findIndex(
              (m) => m.id === selectedProvider.config.defaultModel
            ), 0)}
          />
        </Box>
      )}

      {step === "response_mode" && (
        <Box flexDirection="column">
          <Text bold color="white">Response style</Text>
          <Text> </Text>
          <SelectInput
            items={[
              {
                label: "Concise  No filler, gets to work immediately. Saves tokens. ← recommended",
                value: "concise",
              },
              {
                label: "Explanative  Brief explanations with actions. Still efficient, more context.",
                value: "explanative",
              },
            ]}
            onSelect={handleResponseMode}
          />
          <Text> </Text>
          <Text color="gray" dimColor>Both modes write full, production-quality code. Only conversation style changes.</Text>
        </Box>
      )}

      {step === "summary" && selectedProvider && (
        <Box flexDirection="column">
          <Text bold color="white">All set</Text>
          <Text> </Text>
          <Box flexDirection="column" marginLeft={2}>
            <Box>
              <Text color="gray">{"Provider   "}</Text>
              <Text color="cyan" bold>{selectedProvider.config.name}</Text>
            </Box>
            <Box>
              <Text color="gray">{"Model      "}</Text>
              <Text color="cyan" bold>{modelName}</Text>
            </Box>
            <Box>
              <Text color="gray">{"Style      "}</Text>
              <Text color="cyan" bold>{responseMode}</Text>
            </Box>
            {project && (
              <Box>
                <Text color="gray">{"Project    "}</Text>
                <Text color="cyan">{formatProjectInfo(project)}</Text>
              </Box>
            )}
          </Box>
          <Text> </Text>
          <Text color="gray" dimColor>Change anytime: /provider  /model  /response-mode  /help</Text>
          <Text> </Text>
          <Box>
            <Text color="green" bold>{"❯ "}</Text>
            <Text>Press </Text>
            <Text color="cyan" bold>Enter</Text>
            <Text> to start coding</Text>
          </Box>
          <TextInput value="" onChange={() => {}} onSubmit={handleConfirm} />
        </Box>
      )}

      {step === "done" && (
        <Box>
          <Text color="green" bold>{"✓"} Ready</Text>
        </Box>
      )}
    </Box>
  );
}
