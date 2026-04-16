import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { getAllProviders, searchProviders } from "../providers/index.js";
import { saveSettings } from "../config/settings.js";
import type { OpenAgentSettings, ResponseMode } from "../config/settings.js";
import type { Provider } from "../providers/types.js";
import { getBanner, getTerminalSize } from "../utils/terminal.js";

type SetupStep = "welcome" | "provider_search" | "provider_select" | "model_select" | "api_key" | "response_mode" | "done";

interface SetupProps {
  onComplete: (settings: OpenAgentSettings) => void;
}

export function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState<SetupStep>("welcome");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const { columns } = getTerminalSize();

  const handleWelcome = () => setStep("provider_search");

  const handleProviderSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleProviderSearchSubmit = () => {
    const results = searchQuery ? searchProviders(searchQuery) : getAllProviders();
    if (results.length === 1) {
      setSelectedProvider(results[0]);
      setSelectedModel(results[0].config.defaultModel);
      setStep("api_key");
    } else {
      setStep("provider_select");
    }
  };

  const handleProviderSelect = (item: { value: string }) => {
    const provider = getAllProviders().find((p) => p.config.id === item.value);
    if (provider) {
      setSelectedProvider(provider);
      setSelectedModel(provider.config.defaultModel);
      if (provider.config.id === "ollama") {
        setApiKey("http://localhost:11434");
        setStep("model_select");
      } else {
        setStep("api_key");
      }
    }
  };

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }
    setError("");
    setStep("model_select");
  };

  const handleModelSelect = (item: { value: string }) => {
    setSelectedModel(item.value);
    setStep("response_mode");
  };

  const handleResponseMode = (item: { value: string }) => {
    const settings: OpenAgentSettings = {
      provider: selectedProvider!.config.id,
      model: selectedModel,
      apiKey,
      responseMode: item.value as ResponseMode,
      setupComplete: true,
    };
    saveSettings(settings);
    setStep("done");
    onComplete(settings);
  };

  const filteredProviders = searchQuery
    ? searchProviders(searchQuery)
    : getAllProviders();

  return (
    <Box flexDirection="column" padding={1}>
      <Text>{getBanner(columns)}</Text>
      <Text color="gray">v0.1.0</Text>
      <Text> </Text>

      {step === "welcome" && (
        <Box flexDirection="column">
          <Text bold>Welcome to OpenAgent</Text>
          <Text color="gray">Multi-provider agentic coding in your terminal.</Text>
          <Text> </Text>
          <Text>Press <Text color="cyan" bold>Enter</Text> to start setup</Text>
          <TextInput value="" onChange={() => {}} onSubmit={handleWelcome} />
        </Box>
      )}

      {step === "provider_search" && (
        <Box flexDirection="column">
          <Text bold>Search for your AI provider:</Text>
          <Text color="gray">Type to search, or press Enter to see all</Text>
          <Text> </Text>
          <Box>
            <Text color="cyan">{"> "}</Text>
            <TextInput
              value={searchQuery}
              onChange={handleProviderSearch}
              onSubmit={handleProviderSearchSubmit}
              placeholder="openai, anthropic, gemini, groq, ollama..."
            />
          </Box>
        </Box>
      )}

      {step === "provider_select" && (
        <Box flexDirection="column">
          <Text bold>Select your provider:</Text>
          <Text> </Text>
          <SelectInput
            items={filteredProviders.map((p) => ({
              label: `${p.config.name} — ${p.config.description}`,
              value: p.config.id,
            }))}
            onSelect={handleProviderSelect}
          />
        </Box>
      )}

      {step === "api_key" && selectedProvider && (
        <Box flexDirection="column">
          <Text bold>Enter your {selectedProvider.config.name} API key:</Text>
          <Text color="gray">Get one at: {selectedProvider.config.apiKeyUrl}</Text>
          <Text> </Text>
          {error && <Text color="red">{error}</Text>}
          <Box>
            <Text color="cyan">{"> "}</Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleApiKeySubmit}
              mask="*"
            />
          </Box>
        </Box>
      )}

      {step === "model_select" && selectedProvider && (
        <Box flexDirection="column">
          <Text bold>Select your model:</Text>
          <Text> </Text>
          <SelectInput
            items={selectedProvider.config.models.map((m) => ({
              label: `${m.name} (${Math.round(m.contextWindow / 1000)}k context)`,
              value: m.id,
            }))}
            onSelect={handleModelSelect}
            initialIndex={selectedProvider.config.models.findIndex(
              (m) => m.id === selectedProvider.config.defaultModel
            )}
          />
        </Box>
      )}

      {step === "response_mode" && (
        <Box flexDirection="column">
          <Text bold>Response style:</Text>
          <Text> </Text>
          <SelectInput
            items={[
              {
                label: "Concise (recommended) — No filler, gets straight to work",
                value: "concise",
              },
              {
                label: "Explanative — Brief explanations alongside actions",
                value: "explanative",
              },
            ]}
            onSelect={handleResponseMode}
          />
        </Box>
      )}

      {step === "done" && (
        <Box flexDirection="column">
          <Text color="green" bold>Setup complete.</Text>
          <Text color="gray">
            Provider: {selectedProvider?.config.name} | Model: {selectedModel} | Mode:{" "}
            {apiKey ? "configured" : "local"}
          </Text>
          <Text> </Text>
          <Text>Starting OpenAgent...</Text>
        </Box>
      )}
    </Box>
  );
}
