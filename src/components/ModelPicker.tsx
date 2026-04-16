import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { getAllProviders, getProvider } from "../providers/index.js";
import { loadSettings, saveSettings } from "../config/settings.js";

type Step = "pick" | "key";

interface ModelPickerProps {
  onComplete: (provider: string, model: string) => void;
  onCancel: () => void;
}

export function ModelPicker({ onComplete, onCancel }: ModelPickerProps) {
  const [step, setStep] = useState<Step>("pick");
  const [pendingProvider, setPendingProvider] = useState("");
  const [pendingModel, setPendingModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");

  const settings = loadSettings();

  const allModels: Array<{ label: string; value: string; providerId: string }> = [];
  for (const p of getAllProviders()) {
    for (const m of p.config.models) {
      const current = m.id === settings.model && p.config.id === settings.provider;
      allModels.push({
        label: `${p.config.name.padEnd(14)} ${m.name}${current ? "  (current)" : ""}`,
        value: `${p.config.id}::${m.id}`,
        providerId: p.config.id,
      });
    }
  }

  const handleSelect = (item: { value: string }) => {
    const [providerId, modelId] = item.value.split("::");
    const provider = getProvider(providerId);
    if (!provider) return;

    const sameProvider = providerId === settings.provider;

    if (sameProvider) {
      const updated = loadSettings();
      updated.model = modelId;
      saveSettings(updated);
      onComplete(providerId, modelId);
      return;
    }

    if (providerId === "ollama") {
      const updated = loadSettings();
      updated.provider = providerId;
      updated.model = modelId;
      updated.apiKey = "http://localhost:11434";
      saveSettings(updated);
      onComplete(providerId, modelId);
      return;
    }

    setPendingProvider(providerId);
    setPendingModel(modelId);
    setStep("key");
  };

  const handleKeySubmit = () => {
    if (!apiKey.trim()) {
      setError("API key required");
      return;
    }

    const updated = loadSettings();
    updated.provider = pendingProvider;
    updated.model = pendingModel;
    updated.apiKey = apiKey.trim();
    saveSettings(updated);
    onComplete(pendingProvider, pendingModel);
  };

  if (step === "key") {
    const provider = getProvider(pendingProvider);
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{provider?.config.name || pendingProvider} API key:</Text>
        <Text dimColor>Get one at: {provider?.config.apiKeyUrl || "the provider's website"}</Text>
        <Text> </Text>
        {error && <Text color="red">{error}</Text>}
        <Box>
          <Text color="cyan">{"❯ "}</Text>
          <TextInput value={apiKey} onChange={setApiKey} onSubmit={handleKeySubmit} mask="*" />
        </Box>
      </Box>
    );
  }

  const currentIdx = allModels.findIndex(
    (m) => m.value === `${settings.provider}::${settings.model}`
  );

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text bold color="cyan">Select model:</Text>
      <Text dimColor>Current: {settings.provider}/{settings.model}</Text>
      <Text> </Text>
      <SelectInput
        items={allModels.map((m) => ({ label: m.label, value: m.value }))}
        onSelect={handleSelect}
        initialIndex={Math.max(currentIdx, 0)}
      />
    </Box>
  );
}
