import React, { useState } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { getAllProviders, getProvider } from "../providers/index.js";
import { loadSettings, saveSettings } from "../config/settings.js";

interface ModelPickerProps {
  onComplete: (provider: string, model: string) => void;
  onCancel: () => void;
}

export function ModelPicker({ onComplete, onCancel }: ModelPickerProps) {
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

    if (providerId !== settings.provider) {
      if (providerId !== "ollama" && !settings.apiKey) {
        const updated = loadSettings();
        updated.provider = providerId;
        updated.model = modelId;
        saveSettings(updated);
        onComplete(providerId, modelId);
        return;
      }
    }

    const updated = loadSettings();
    updated.provider = providerId;
    updated.model = modelId;
    saveSettings(updated);
    onComplete(providerId, modelId);
  };

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
