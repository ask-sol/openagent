import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { getAllProviders, searchProviders, getProvider } from "../providers/index.js";
import { loadSettings, saveSettings } from "../config/settings.js";
import type { Provider } from "../providers/types.js";

type Step = "provider" | "key" | "model" | "done";

interface ProviderPickerProps {
  onComplete: (provider: string, model: string) => void;
  onCancel: () => void;
}

export function ProviderPicker({ onComplete, onCancel }: ProviderPickerProps) {
  const [step, setStep] = useState<Step>("provider");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");

  const settings = loadSettings();

  useInput((_, key) => {
    if (!key.escape) return;
    switch (step) {
      case "provider":
        onCancel();
        return;
      case "key":
        setStep("provider");
        setApiKey("");
        setError("");
        return;
      case "model":
        setStep(selectedProvider?.config.id === "ollama" ? "provider" : "key");
        return;
    }
  });

  const handleProviderSelect = (item: { value: string }) => {
    const provider = getProvider(item.value);
    if (!provider) return;
    setSelectedProvider(provider);

    if (provider.config.id === settings.provider && settings.apiKey) {
      setApiKey(settings.apiKey);
      setStep("model");
    } else if (provider.config.id === "ollama") {
      setApiKey("http://localhost:11434");
      setStep("model");
    } else {
      setStep("key");
    }
  };

  const handleKeySubmit = () => {
    if (!apiKey.trim()) {
      setError("API key required");
      return;
    }
    setError("");
    setStep("model");
  };

  const handleModelSelect = (item: { value: string }) => {
    if (!selectedProvider) return;

    const updated = loadSettings();
    updated.provider = selectedProvider.config.id;
    updated.model = item.value;
    updated.apiKey = apiKey;
    saveSettings(updated);

    setStep("done");
    onComplete(selectedProvider.config.id, item.value);
  };

  if (step === "provider") {
    const providers = getAllProviders();
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Select provider:</Text>
        <Text> </Text>
        <SelectInput
          items={providers.map((p) => ({
            label: `${p.config.name} — ${p.config.description}${p.config.id === settings.provider ? "  (current)" : ""}`,
            value: p.config.id,
          }))}
          onSelect={handleProviderSelect}
        />
        <Text> </Text>
        <Text dimColor>Press Esc or type /cancel to go back</Text>
      </Box>
    );
  }

  if (step === "key" && selectedProvider) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{selectedProvider.config.name} API key:</Text>
        <Text dimColor>Get one at: {selectedProvider.config.apiKeyUrl}</Text>
        <Text> </Text>
        {error && <Text color="red">{error}</Text>}
        <Box>
          <Text color="cyan">{"❯ "}</Text>
          <TextInput value={apiKey} onChange={setApiKey} onSubmit={handleKeySubmit} mask="*" />
        </Box>
      </Box>
    );
  }

  if (step === "model" && selectedProvider) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Select model for {selectedProvider.config.name}:</Text>
        <Text> </Text>
        <SelectInput
          items={selectedProvider.config.models.map((m) => ({
            label: `${m.name} — ${Math.round(m.contextWindow / 1000)}k context, ${Math.round(m.maxOutput / 1000)}k output${m.id === selectedProvider.config.defaultModel ? "  (recommended)" : ""}`,
            value: m.id,
          }))}
          onSelect={handleModelSelect}
          initialIndex={selectedProvider.config.models.findIndex(
            (m) => m.id === selectedProvider.config.defaultModel
          )}
        />
      </Box>
    );
  }

  return null;
}
