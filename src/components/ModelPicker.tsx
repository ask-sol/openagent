import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { totalmem } from "node:os";
import { getAllProviders, getProvider } from "../providers/index.js";
import { loadSettings, saveSettings } from "../config/settings.js";

type Step = "pick" | "key" | "pulling";

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
  const [pullProgress, setPullProgress] = useState("");
  const [pullModel, setPullModel] = useState("");

  const settings = loadSettings();
  const sysRAM = Math.round(totalmem() / 1024 / 1024 / 1024);

  const items: Array<{ label: string; value: string }> = [];

  items.push({ label: "── Cloud ──────────────────────────────────", value: "__header_cloud__" });
  for (const p of getAllProviders().filter(p => p.config.category === "cloud")) {
    for (const m of p.config.models) {
      const current = m.id === settings.model && p.config.id === settings.provider;
      items.push({
        label: `  ${p.config.name.padEnd(14)} ${m.name}${current ? "  ← current" : ""}`,
        value: `${p.config.id}::${m.id}`,
      });
    }
  }

  items.push({ label: "── Local (Ollama) ─────────────────────────", value: "__header_local__" });
  const ollamaProvider = getProvider("ollama");
  if (ollamaProvider) {
    for (const m of ollamaProvider.config.models) {
      const current = m.id === settings.model && settings.provider === "ollama";
      items.push({
        label: `  ${m.name.padEnd(24)} (ollama pull ${m.id})${current ? "  ← current" : ""}`,
        value: `ollama::${m.id}`,
      });
    }
  }
  items.push({
    label: `  Custom model name...`,
    value: "__custom_ollama__",
  });

  const handleSelect = (item: { value: string }) => {
    if (item.value.startsWith("__header")) return;

    if (item.value === "__custom_ollama__") {
      setPendingProvider("ollama");
      setStep("key");
      return;
    }

    const [providerId, modelId] = item.value.split("::");

    if (providerId === settings.provider) {
      const updated = loadSettings();
      updated.model = modelId;
      saveSettings(updated);
      onComplete(providerId, modelId);
      return;
    }

    if (providerId === "ollama") {
      startOllamaPull(modelId);
      return;
    }

    if (providerId === "bedrock") {
      const updated = loadSettings();
      updated.provider = "bedrock";
      updated.model = modelId;
      updated.apiKey = "aws-iam";
      saveSettings(updated);
      onComplete("bedrock", modelId);
      return;
    }

    setPendingProvider(providerId);
    setPendingModel(modelId);
    setStep("key");
  };

  function startOllamaPull(model: string) {
    setPullModel(model);
    setPullProgress("Checking if Ollama is running...");
    setStep("pulling");

    import("node:child_process").then(({ exec, spawn }) => {
      exec("ollama list", { timeout: 5000 }, (err, stdout) => {
        if (err) {
          exec("which ollama", { timeout: 3000 }, (err2) => {
            if (err2) {
              setPullProgress("Ollama not installed. Install from https://ollama.com/download then try again.");
              setTimeout(() => { setStep("pick"); }, 3000);
            } else {
              setPullProgress("Starting Ollama...");
              exec("ollama serve &", { timeout: 3000 }, () => {
                doPull(model, spawn);
              });
            }
          });
          return;
        }

        const installed = stdout.split("\n").some(line => line.toLowerCase().includes(model.split(":")[0]));
        if (installed) {
          setPullProgress(`${model} already available.`);
          finishOllamaSetup(model);
          return;
        }

        doPull(model, spawn);
      });
    });
  }

  function doPull(model: string, spawn: any) {
    setPullProgress(`Pulling ${model}... this may take a while.`);

    const child = spawn("ollama", ["pull", model], { stdio: ["ignore", "pipe", "pipe"] });
    let lastLine = "";

    child.stdout?.on("data", (data: Buffer) => {
      lastLine = data.toString().trim().split("\n").pop() || lastLine;
      setPullProgress(`Pulling ${model}... ${lastLine}`);
    });

    child.stderr?.on("data", (data: Buffer) => {
      lastLine = data.toString().trim().split("\n").pop() || lastLine;
      setPullProgress(`Pulling ${model}... ${lastLine}`);
    });

    child.on("close", (code: number) => {
      if (code === 0) {
        setPullProgress(`${model} ready.`);
        finishOllamaSetup(model);
      } else {
        setPullProgress(`Pull failed (exit ${code}). Make sure Ollama is running.`);
        setTimeout(() => { setStep("pick"); }, 3000);
      }
    });

    child.on("error", () => {
      setPullProgress("Failed to run ollama. Is it installed?");
      setTimeout(() => { setStep("pick"); }, 3000);
    });
  }

  function finishOllamaSetup(model: string) {
    const updated = loadSettings();
    updated.provider = "ollama";
    updated.model = model;
    updated.apiKey = "http://localhost:11434";
    saveSettings(updated);
    setTimeout(() => onComplete("ollama", model), 1000);
  }

  const handleKeySubmit = () => {
    const val = apiKey.trim();
    if (pendingProvider === "ollama") {
      const model = val || "llama3.2:latest";
      startOllamaPull(model);
      return;
    }

    if (!val) { setError("API key required"); return; }
    const updated = loadSettings();
    updated.provider = pendingProvider;
    updated.model = pendingModel;
    updated.apiKey = val;
    saveSettings(updated);
    onComplete(pendingProvider, pendingModel);
  };

  if (step === "key") {
    if (pendingProvider === "ollama") {
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Text bold color="cyan">Ollama — enter model name:</Text>
          <Text dimColor>System RAM: {sysRAM}GB — suggested: {sysRAM >= 64 ? "llama3.3:70b" : sysRAM >= 32 ? "qwen2.5-coder:32b" : "llama3.2:latest"}</Text>
          <Text dimColor>We'll download and set it up automatically.</Text>
          <Text> </Text>
          <Box><Text color="cyan">{"❯ "}</Text><TextInput value={apiKey} onChange={setApiKey} onSubmit={handleKeySubmit} placeholder="llama3.2:latest" /></Box>
        </Box>
      );
    }

    const provider = getProvider(pendingProvider);
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

  if (step === "pulling") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Setting up {pullModel}</Text>
        <Text> </Text>
        <Text color="yellow">{pullProgress}</Text>
      </Box>
    );
  }

  const currentIdx = items.findIndex(i => i.value === `${settings.provider}::${settings.model}`);

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text bold color="cyan">Select model:</Text>
      <Text dimColor>Current: {settings.provider}/{settings.model}</Text>
      <Text> </Text>
      <SelectInput
        items={items}
        onSelect={handleSelect}
        initialIndex={Math.max(currentIdx, 1)}
      />
    </Box>
  );
}
