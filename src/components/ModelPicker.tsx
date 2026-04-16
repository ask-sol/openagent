import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { getAllProviders, getProvider } from "../providers/index.js";
import { loadSettings, saveSettings } from "../config/settings.js";

type Step = "category" | "provider" | "model" | "key" | "ollama-setup";

interface ModelPickerProps {
  onComplete: (provider: string, model: string) => void;
  onCancel: () => void;
}

export function ModelPicker({ onComplete, onCancel }: ModelPickerProps) {
  const [step, setStep] = useState<Step>("category");
  const [selectedCategory, setSelectedCategory] = useState<"cloud" | "local">("cloud");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [pendingModel, setPendingModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [error, setError] = useState("");

  const settings = loadSettings();

  const handleCategorySelect = (item: { value: string }) => {
    setSelectedCategory(item.value as "cloud" | "local");
    if (item.value === "local") {
      setSelectedProviderId("ollama");
      setStep("ollama-setup");
    } else {
      setStep("provider");
    }
  };

  const handleProviderSelect = (item: { value: string }) => {
    setSelectedProviderId(item.value);
    setStep("model");
  };

  const handleModelSelect = (item: { value: string }) => {
    const provider = getProvider(selectedProviderId);
    if (!provider) return;

    if (selectedProviderId === settings.provider) {
      const updated = loadSettings();
      updated.model = item.value;
      saveSettings(updated);
      onComplete(selectedProviderId, item.value);
      return;
    }

    setPendingModel(item.value);
    if (selectedProviderId === "ollama") {
      const updated = loadSettings();
      updated.provider = "ollama";
      updated.model = item.value;
      updated.apiKey = "http://localhost:11434";
      saveSettings(updated);
      onComplete("ollama", item.value);
      return;
    }

    if (selectedProviderId === "bedrock") {
      const updated = loadSettings();
      updated.provider = "bedrock";
      updated.model = item.value;
      updated.apiKey = "aws-iam";
      saveSettings(updated);
      onComplete("bedrock", item.value);
      return;
    }

    setStep("key");
  };

  const handleKeySubmit = () => {
    if (!apiKey.trim()) { setError("API key required"); return; }
    const updated = loadSettings();
    updated.provider = selectedProviderId;
    updated.model = pendingModel;
    updated.apiKey = apiKey.trim();
    saveSettings(updated);
    onComplete(selectedProviderId, pendingModel);
  };

  const handleOllamaModel = (val: string) => {
    if (!val.trim()) return;
    const updated = loadSettings();
    updated.provider = "ollama";
    updated.model = val.trim();
    updated.apiKey = "http://localhost:11434";
    saveSettings(updated);
    onComplete("ollama", val.trim());
  };

  if (step === "category") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Where do you want to run models?</Text>
        <Text> </Text>
        <SelectInput
          items={[
            { label: "☁  Cloud — OpenRouter, OpenAI, Anthropic, Gemini, AWS Bedrock, etc.", value: "cloud" },
            { label: "💻 Local — Run models on your machine with Ollama", value: "local" },
          ]}
          onSelect={handleCategorySelect}
        />
      </Box>
    );
  }

  if (step === "provider") {
    const cloudProviders = getAllProviders().filter(p => p.config.category === "cloud");
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Select cloud provider:</Text>
        <Text dimColor>Current: {settings.provider}/{settings.model}</Text>
        <Text> </Text>
        <SelectInput
          items={cloudProviders.map(p => ({
            label: `${p.config.name.padEnd(16)} ${p.config.description}${p.config.id === settings.provider ? "  (current)" : ""}`,
            value: p.config.id,
          }))}
          onSelect={handleProviderSelect}
        />
      </Box>
    );
  }

  if (step === "model") {
    const provider = getProvider(selectedProviderId);
    if (!provider) return null;
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{provider.config.name} — pick a model:</Text>
        <Text> </Text>
        <SelectInput
          items={provider.config.models.map(m => ({
            label: `${m.name}  ${Math.round(m.contextWindow / 1000)}k context${m.id === provider.config.defaultModel ? "  ← recommended" : ""}`,
            value: m.id,
          }))}
          onSelect={handleModelSelect}
          initialIndex={Math.max(provider.config.models.findIndex(m => m.id === provider.config.defaultModel), 0)}
        />
      </Box>
    );
  }

  if (step === "key") {
    const provider = getProvider(selectedProviderId);
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{provider?.config.name} API key:</Text>
        <Text dimColor>Get one at: {provider?.config.apiKeyUrl}</Text>
        <Text> </Text>
        {error && <Text color="red">{error}</Text>}
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={apiKey} onChange={setApiKey} onSubmit={handleKeySubmit} mask="*" /></Box>
      </Box>
    );
  }

  if (step === "ollama-setup") {
    const provider = getProvider("ollama");
    const sysRAM = Math.round((require("node:os").totalmem?.() || 0) / 1024 / 1024 / 1024);
    const recommended = sysRAM >= 64 ? "llama3.3:70b" : sysRAM >= 32 ? "qwen2.5-coder:32b" : "llama3.2:latest";

    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Local Model Setup</Text>
        <Text> </Text>
        <Text>System RAM: <Text color="yellow">{sysRAM}GB</Text></Text>
        <Text>Suggested: <Text color="green">{recommended}</Text></Text>
        <Text> </Text>
        <Text dimColor>Requirements (GPU strongly recommended for all):</Text>
        <Text dimColor>  8B models  → 16GB RAM, or GPU with 8GB+ VRAM</Text>
        <Text dimColor>  32B models → 32GB RAM, or GPU with 16GB+ VRAM</Text>
        <Text dimColor>  70B models → 64GB RAM, or GPU with 24GB+ VRAM (RTX 4090, A6000)</Text>
        <Text dimColor>  Recommended GPU: NVIDIA RTX 4060 Ti 16GB ($400) for 8B-32B models</Text>
        <Text> </Text>
        <Text>1. Install Ollama: <Text color="cyan">https://ollama.com/download</Text></Text>
        <Text>2. Pull a model: <Text color="cyan">ollama pull {recommended}</Text></Text>
        <Text> </Text>
        <Text bold>Pick a preset or type a model name:</Text>
        <Text> </Text>
        <SelectInput
          items={[
            ...(provider?.config.models || []).map(m => ({
              label: `${m.name}  (ollama pull ${m.id})`,
              value: m.id,
            })),
            { label: "Custom — type a model name", value: "__custom__" },
          ]}
          onSelect={(item) => {
            if (item.value === "__custom__") {
              setStep("model");
              setSelectedProviderId("ollama");
              return;
            }
            handleOllamaModel(item.value);
          }}
        />
      </Box>
    );
  }

  return null;
}
