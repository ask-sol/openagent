import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import { totalmem } from "node:os";
import { getAllProviders, getProvider } from "../providers/index.js";
import { loadSettings, saveSettings } from "../config/settings.js";

type Step = "type" | "cloud-provider" | "cloud-model" | "cloud-key" | "local-check" | "local-model" | "local-confirm" | "local-custom" | "pulling" | "installing-ollama";

interface ModelPickerProps {
  onComplete: (provider: string, model: string) => void;
  onCancel: () => void;
}

const LOCAL_MODELS = [
  { id: "llama3.2:latest", name: "Llama 3.2 3B", size: "2.0 GB", ram: "8 GB" },
  { id: "llama3.1:8b", name: "Llama 3.1 8B", size: "4.7 GB", ram: "16 GB" },
  { id: "qwen2.5-coder:7b", name: "Qwen 2.5 Coder 7B", size: "4.7 GB", ram: "16 GB" },
  { id: "mistral:latest", name: "Mistral 7B", size: "4.1 GB", ram: "16 GB" },
  { id: "deepseek-coder-v2:latest", name: "DeepSeek Coder V2 16B", size: "8.9 GB", ram: "24 GB" },
  { id: "qwen2.5-coder:32b", name: "Qwen 2.5 Coder 32B", size: "19 GB", ram: "32 GB" },
  { id: "llama3.3:70b", name: "Llama 3.3 70B", size: "40 GB", ram: "64 GB+" },
];

export function ModelPicker({ onComplete, onCancel }: ModelPickerProps) {
  const [step, setStep] = useState<Step>("type");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedLocalModel, setSelectedLocalModel] = useState<typeof LOCAL_MODELS[0] | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [customHost, setCustomHost] = useState("");
  const [error, setError] = useState("");
  const [pullProgress, setPullProgress] = useState("");
  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);

  const settings = loadSettings();
  const sysRAM = Math.round(totalmem() / 1024 / 1024 / 1024);

  useEffect(() => {
    if (step === "local-model") {
      import("node:child_process").then(({ exec }) => {
        exec("ollama --version", { timeout: 3000 }, (err) => {
          setOllamaInstalled(!err);
        });
      });
    }
  }, [step]);

  function startPull(model: string) {
    setPullProgress("Starting download...");
    setStep("pulling");

    import("node:child_process").then(({ exec, spawn }) => {
      exec("ollama list", { timeout: 5000 }, (err, stdout) => {
        if (err) {
          exec("ollama serve &", () => {});
          setTimeout(() => doPull(model, spawn), 2000);
          return;
        }

        const already = stdout.split("\n").some(l => l.toLowerCase().startsWith(model.split(":")[0]));
        if (already) {
          setPullProgress("Model ready.");
          finish(model);
          return;
        }

        doPull(model, spawn);
      });
    });
  }

  function doPull(model: string, spawn: any) {
    const child = spawn("ollama", ["pull", model], { stdio: ["ignore", "pipe", "pipe"] });

    child.stdout?.on("data", (d: Buffer) => {
      const line = d.toString().trim().split("\n").pop() || "";
      setPullProgress(line);
    });
    child.stderr?.on("data", (d: Buffer) => {
      const line = d.toString().trim().split("\n").pop() || "";
      setPullProgress(line);
    });

    child.on("close", (code: number) => {
      if (code === 0) {
        setPullProgress("Download complete.");
        finish(model);
      } else {
        setPullProgress("Download failed. Is Ollama running?");
        setTimeout(() => setStep("local-model"), 3000);
      }
    });

    child.on("error", () => {
      setPullProgress("Failed to run ollama.");
      setTimeout(() => setStep("local-model"), 3000);
    });
  }

  function finish(model: string) {
    const updated = loadSettings();
    updated.provider = "ollama";
    updated.model = model;
    updated.apiKey = "http://localhost:11434";
    saveSettings(updated);
    setTimeout(() => onComplete("ollama", model), 800);
  }

  if (step === "type") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">How do you want to run models?</Text>
        <Text> </Text>
        <SelectInput
          items={[
            { label: "Cloud   Use an API key (OpenRouter, OpenAI, Anthropic, Gemini, etc.)", value: "cloud" },
            { label: "Local   Run a model on this machine with Ollama", value: "local" },
          ]}
          onSelect={(item) => setStep(item.value === "cloud" ? "cloud-provider" : "local-check")}
        />
      </Box>
    );
  }

  if (step === "cloud-provider") {
    const cloud = getAllProviders().filter(p => p.config.category === "cloud");
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Select provider:</Text>
        <Text> </Text>
        <SelectInput
          items={cloud.map(p => ({
            label: `${p.config.name.padEnd(16)} ${p.config.description}`,
            value: p.config.id,
          }))}
          onSelect={(item) => { setSelectedProvider(item.value); setStep("cloud-model"); }}
        />
      </Box>
    );
  }

  if (step === "cloud-model") {
    const provider = getProvider(selectedProvider);
    if (!provider) return null;
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{provider.config.name} — pick a model:</Text>
        <Text> </Text>
        <SelectInput
          items={provider.config.models.map(m => ({
            label: `${m.name}  ${Math.round(m.contextWindow / 1000)}k ctx${m.id === provider.config.defaultModel ? "  ← recommended" : ""}`,
            value: m.id,
          }))}
          onSelect={(item) => {
            setSelectedModel(item.value);
            if (selectedProvider === settings.provider) {
              const updated = loadSettings();
              updated.model = item.value;
              saveSettings(updated);
              onComplete(selectedProvider, item.value);
            } else if (selectedProvider === "bedrock") {
              const updated = loadSettings();
              updated.provider = "bedrock";
              updated.model = item.value;
              updated.apiKey = "aws-iam";
              saveSettings(updated);
              onComplete("bedrock", item.value);
            } else {
              setStep("cloud-key");
            }
          }}
          initialIndex={Math.max(provider.config.models.findIndex(m => m.id === provider.config.defaultModel), 0)}
        />
      </Box>
    );
  }

  if (step === "cloud-key") {
    const provider = getProvider(selectedProvider);
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{provider?.config.name} API key:</Text>
        <Text dimColor>{provider?.config.apiKeyUrl}</Text>
        <Text> </Text>
        {error && <Text color="red">{error}</Text>}
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={apiKey} onChange={setApiKey} onSubmit={() => {
          if (!apiKey.trim()) { setError("Required"); return; }
          const updated = loadSettings();
          updated.provider = selectedProvider;
          updated.model = selectedModel;
          updated.apiKey = apiKey.trim();
          saveSettings(updated);
          onComplete(selectedProvider, selectedModel);
        }} mask="*" /></Box>
      </Box>
    );
  }

  if (step === "local-check") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color="cyan"><Spinner type="dots" /> Checking for Ollama...</Text>
        {(() => {
          import("node:child_process").then(({ exec }) => {
            exec("ollama --version", { timeout: 3000 }, (err) => {
              if (err) {
                setStep("installing-ollama");
              } else {
                setOllamaInstalled(true);
                setStep("local-model");
              }
            });
          });
          return null;
        })()}
      </Box>
    );
  }

  if (step === "installing-ollama") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Ollama not found</Text>
        <Text> </Text>
        <Text>Ollama is needed to run local models.</Text>
        <Text> </Text>
        <SelectInput
          items={[
            { label: "Install Ollama automatically", value: "install" },
            { label: "I'll install it myself (ollama.com/download)", value: "skip" },
            { label: "Go back", value: "back" },
          ]}
          onSelect={(item) => {
            if (item.value === "back") { setStep("type"); return; }
            if (item.value === "skip") { setStep("local-model"); return; }

            setPullProgress("Installing Ollama...");
            setStep("pulling");

            import("node:child_process").then(({ exec }) => {
              const platform = process.platform;
              let cmd: string;

              if (platform === "darwin") {
                cmd = "brew install ollama 2>&1 && ollama serve &";
              } else {
                cmd = "curl -fsSL https://ollama.com/install.sh | sh 2>&1";
              }

              exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
                if (err) {
                  setPullProgress(`Install failed: ${(stderr || stdout || err.message).slice(0, 200)}`);
                  setTimeout(() => setStep("local-model"), 4000);
                } else {
                  setPullProgress("Ollama installed. Starting...");
                  exec("ollama serve &", { timeout: 5000 }, () => {
                    setOllamaInstalled(true);
                    setTimeout(() => setStep("local-model"), 1500);
                  });
                }
              });
            });
          }}
        />
      </Box>
    );
  }

  if (step === "local-model") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Pick a model to run locally:</Text>
        <Text dimColor>System RAM: {sysRAM}GB {ollamaInstalled === false && <Text color="red">  Ollama not found — install from ollama.com/download</Text>}</Text>
        <Text> </Text>
        <SelectInput
          items={[
            ...LOCAL_MODELS.map(m => ({
              label: `${m.name.padEnd(24)} ${m.size.padEnd(8)} needs ${m.ram}${sysRAM < parseInt(m.ram) ? "  ⚠ may be slow" : ""}`,
              value: m.id,
            })),
            { label: "Enter a custom model name or server URL...", value: "__custom__" },
          ]}
          onSelect={(item) => {
            if (item.value === "__custom__") {
              setStep("local-custom");
              return;
            }
            const model = LOCAL_MODELS.find(m => m.id === item.value)!;
            setSelectedLocalModel(model);
            setStep("local-confirm");
          }}
        />
      </Box>
    );
  }

  if (step === "local-confirm" && selectedLocalModel) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Download {selectedLocalModel.name}?</Text>
        <Text> </Text>
        <Text>  Size:     <Text color="yellow">{selectedLocalModel.size}</Text></Text>
        <Text>  RAM:      <Text color="yellow">{selectedLocalModel.ram}</Text></Text>
        <Text>  Your RAM: <Text color={sysRAM >= parseInt(selectedLocalModel.ram) ? "green" : "red"}>{sysRAM}GB</Text></Text>
        <Text> </Text>
        <SelectInput
          items={[
            { label: "Yes — download and set up", value: "yes" },
            { label: "No — go back", value: "no" },
          ]}
          onSelect={(item) => {
            if (item.value === "yes") {
              startPull(selectedLocalModel.id);
            } else {
              setStep("local-model");
            }
          }}
        />
      </Box>
    );
  }

  if (step === "local-custom") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Enter a model name or Ollama server URL:</Text>
        <Text dimColor>Model name (e.g. phi3:latest) or server (e.g. http://192.168.1.5:11434)</Text>
        <Text> </Text>
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={customHost} onChange={setCustomHost} onSubmit={() => {
          const val = customHost.trim();
          if (!val) return;

          if (val.startsWith("http")) {
            const updated = loadSettings();
            updated.provider = "ollama";
            updated.model = "llama3.2:latest";
            updated.apiKey = val;
            saveSettings(updated);
            onComplete("ollama", "llama3.2:latest");
          } else {
            startPull(val);
          }
        }} placeholder="llama3.2:latest or http://..." /></Box>
      </Box>
    );
  }

  if (step === "pulling") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan"><Spinner type="dots" /> Downloading model</Text>
        <Text> </Text>
        <Text color="yellow">{pullProgress}</Text>
      </Box>
    );
  }

  return null;
}
