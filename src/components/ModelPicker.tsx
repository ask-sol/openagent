import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import { totalmem, platform as osPlatform, arch as osArch } from "node:os";
import { getAllProviders, getProvider } from "../providers/index.js";
import { loadSettings, saveSettings } from "../config/settings.js";
import { parsePullPercent } from "../utils/progressBar.js";

type Step =
  | "type"
  | "cloud-provider"
  | "cloud-model"
  | "cloud-key"
  | "cloud-auth-method"
  | "claude-login"
  | "claude-proxy-setup"
  | "local-runtime"
  | "local-check"
  | "local-model"
  | "local-confirm"
  | "local-custom"
  | "pulling"
  | "installing-runtime";

type LocalRuntime = "ollama" | "lmstudio" | "mlx";

interface ModelPickerProps {
  onComplete: (provider: string, model: string) => void;
  onCancel: () => void;
}

interface LocalModelInfo {
  id: string;
  name: string;
  size: string;
  ram: string;
}

const LOCAL_MODELS_BY_RUNTIME: Record<LocalRuntime, LocalModelInfo[]> = {
  ollama: [
    { id: "llama3.2:latest", name: "Llama 3.2 3B", size: "2.0 GB", ram: "8 GB" },
    { id: "llama3.1:8b", name: "Llama 3.1 8B", size: "4.7 GB", ram: "16 GB" },
    { id: "qwen2.5-coder:7b", name: "Qwen 2.5 Coder 7B", size: "4.7 GB", ram: "16 GB" },
    { id: "mistral:latest", name: "Mistral 7B", size: "4.1 GB", ram: "16 GB" },
    { id: "deepseek-coder-v2:latest", name: "DeepSeek Coder V2 16B", size: "8.9 GB", ram: "24 GB" },
    { id: "qwen2.5-coder:32b", name: "Qwen 2.5 Coder 32B", size: "19 GB", ram: "32 GB" },
    { id: "llama3.3:70b", name: "Llama 3.3 70B", size: "40 GB", ram: "64 GB+" },
  ],
  lmstudio: [
    { id: "lmstudio-community/Llama-3.2-3B-Instruct-GGUF", name: "Llama 3.2 3B", size: "2.0 GB", ram: "8 GB" },
    { id: "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF", name: "Llama 3.1 8B", size: "4.9 GB", ram: "16 GB" },
    { id: "lmstudio-community/Qwen2.5-Coder-7B-Instruct-GGUF", name: "Qwen 2.5 Coder 7B", size: "4.7 GB", ram: "16 GB" },
    { id: "lmstudio-community/Mistral-7B-Instruct-v0.3-GGUF", name: "Mistral 7B", size: "4.1 GB", ram: "16 GB" },
    { id: "lmstudio-community/DeepSeek-Coder-V2-Lite-Instruct-GGUF", name: "DeepSeek Coder V2 Lite", size: "9.5 GB", ram: "24 GB" },
    { id: "lmstudio-community/Qwen2.5-Coder-32B-Instruct-GGUF", name: "Qwen 2.5 Coder 32B", size: "19 GB", ram: "32 GB" },
  ],
  mlx: [
    { id: "mlx-community/Llama-3.2-3B-Instruct-4bit", name: "Llama 3.2 3B (4-bit)", size: "1.8 GB", ram: "8 GB" },
    { id: "mlx-community/Meta-Llama-3.1-8B-Instruct-4bit", name: "Llama 3.1 8B (4-bit)", size: "4.5 GB", ram: "16 GB" },
    { id: "mlx-community/Qwen2.5-Coder-7B-Instruct-4bit", name: "Qwen 2.5 Coder 7B (4-bit)", size: "4.3 GB", ram: "16 GB" },
    { id: "mlx-community/Mistral-7B-Instruct-v0.3-4bit", name: "Mistral 7B (4-bit)", size: "4.0 GB", ram: "16 GB" },
    { id: "mlx-community/DeepSeek-Coder-V2-Lite-Instruct-4bit", name: "DeepSeek Coder V2 Lite (4-bit)", size: "9.0 GB", ram: "24 GB" },
    { id: "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit", name: "Qwen 2.5 Coder 32B (4-bit)", size: "18 GB", ram: "32 GB" },
  ],
};

interface RuntimeCmds {
  label: string;
  binCheck: string;
  installDarwin: string;
  installLinux: string;
  postInstall?: string;
  healthUrl: string;
  startServer: string;
  pull: (model: string) => string;
  postPull?: (model: string) => string;
  providerId: string;
  apiKey: string;
  port: number;
  installUrl: string;
  requiresAppleSilicon?: boolean;
}

const RUNTIME_CMDS: Record<LocalRuntime, RuntimeCmds> = {
  ollama: {
    label: "Ollama",
    binCheck: "ollama --version",
    installDarwin: "brew install ollama 2>&1",
    installLinux: "curl -fsSL https://ollama.com/install.sh | sh 2>&1",
    healthUrl: "http://localhost:11434/api/tags",
    startServer: "ollama serve",
    pull: (m) => `ollama pull ${m}`,
    providerId: "ollama",
    apiKey: "http://localhost:11434",
    port: 11434,
    installUrl: "https://ollama.com/download",
  },
  lmstudio: {
    label: "LM Studio",
    binCheck: "lms --version 2>/dev/null || test -x ~/.lmstudio/bin/lms",
    installDarwin: "brew install --cask lm-studio 2>&1",
    installLinux: "echo 'LM Studio on Linux requires manual install from https://lmstudio.ai/download' >&2; exit 1",
    postInstall: "~/.lmstudio/bin/lms bootstrap 2>&1 || (open -a 'LM Studio' 2>/dev/null && sleep 3)",
    healthUrl: "http://localhost:1234/v1/models",
    startServer: "lms server start 2>&1 || ~/.lmstudio/bin/lms server start 2>&1",
    pull: (m) => `(lms get "${m}" -y 2>&1 || ~/.lmstudio/bin/lms get "${m}" -y 2>&1)`,
    providerId: "lmstudio",
    apiKey: "http://localhost:1234/v1",
    port: 1234,
    installUrl: "https://lmstudio.ai/download",
  },
  mlx: {
    label: "MLX",
    binCheck: "python3 -c 'import mlx_lm' 2>/dev/null",
    installDarwin: "pip3 install --user --upgrade mlx-lm 2>&1",
    installLinux: "echo 'MLX requires Apple Silicon (macOS).' >&2; exit 1",
    healthUrl: "http://localhost:8080/v1/models",
    startServer: "",
    pull: (m) => `python3 -c "from huggingface_hub import snapshot_download; snapshot_download('${m}')" 2>&1`,
    postPull: (m) => `nohup python3 -m mlx_lm.server --model ${m} --port 8080 > /tmp/openagent-mlx.log 2>&1 & sleep 4`,
    providerId: "mlx",
    apiKey: "http://localhost:8080/v1",
    port: 8080,
    installUrl: "https://github.com/ml-explore/mlx-lm",
    requiresAppleSilicon: true,
  },
};

export function ModelPicker({ onComplete, onCancel }: ModelPickerProps) {
  const [step, setStep] = useState<Step>("type");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedLocalModel, setSelectedLocalModel] = useState<LocalModelInfo | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [customHost, setCustomHost] = useState("");
  const [error, setError] = useState("");
  const [pullProgress, setPullProgress] = useState("");
  const [pullPercent, setPullPercent] = useState<number | null>(null);
  const [runtimeInstalled, setRuntimeInstalled] = useState<boolean | null>(null);
  const [localRuntime, setLocalRuntime] = useState<LocalRuntime>("ollama");
  const loginStartedRef = useRef(false);

  const settings = loadSettings();
  const sysRAM = Math.round(totalmem() / 1024 / 1024 / 1024);
  const isAppleSilicon = osPlatform() === "darwin" && osArch() === "arm64";
  const localModels = LOCAL_MODELS_BY_RUNTIME[localRuntime];
  const rt = RUNTIME_CMDS[localRuntime];

  useInput((_, key) => {
    if (!key.escape) return;
    switch (step) {
      case "type":
        onCancel();
        return;
      case "cloud-provider":
        setStep("type");
        return;
      case "cloud-model":
        setStep("cloud-provider");
        return;
      case "cloud-key":
        setStep("cloud-model");
        setApiKey("");
        setError("");
        return;
      case "cloud-auth-method":
        setStep("cloud-model");
        return;
      case "local-runtime":
        setStep("type");
        return;
      case "local-check":
      case "installing-runtime":
        setStep("local-runtime");
        return;
      case "local-model":
        setStep("local-runtime");
        return;
      case "local-confirm":
      case "local-custom":
        setStep("local-model");
        return;
    }
  });

  useEffect(() => {
    if (step === "local-model") {
      import("node:child_process").then(({ exec }) => {
        exec(rt.binCheck, { timeout: 3000, shell: "/bin/bash" } as any, (err) => {
          setRuntimeInstalled(!err);
        });
      });
    }
  }, [step, localRuntime]);

  useEffect(() => {
    if (step !== "claude-login" || loginStartedRef.current) return;
    loginStartedRef.current = true;

    import("../services/claudeOAuth.js").then(({ startOAuthLogin, loadOAuthTokens }) => {
      startOAuthLogin().then(async (result) => {
        if (result.success) {
          const tokens = loadOAuthTokens();
          if (tokens?.accessToken) {
            const updated = loadSettings();
            updated.provider = "anthropic";
            updated.model = selectedModel;
            updated.apiKey = tokens.accessToken;
            saveSettings(updated);
            onComplete("anthropic", selectedModel);
          } else {
            setPullProgress("Login succeeded but no token found.");
            loginStartedRef.current = false;
            setTimeout(() => setStep("cloud-auth-method"), 3000);
          }
        } else {
          setPullProgress(result.error || "Login failed");
          loginStartedRef.current = false;
          setTimeout(() => setStep("cloud-auth-method"), 3000);
        }
      });
    });
  }, [step]);

  useEffect(() => {
    if (step !== "claude-proxy-setup" || loginStartedRef.current) return;
    loginStartedRef.current = true;

    import("../services/claudeProxy.js").then(({ setupClaudeMax, getProxyConfig }) => {
      setupClaudeMax((msg) => setPullProgress(msg)).then((success) => {
        if (success) {
          const proxy = getProxyConfig();
          const updated = loadSettings();
          updated.provider = proxy.provider;
          updated.model = selectedModel || proxy.model;
          updated.apiKey = proxy.apiKey;
          updated.baseUrl = proxy.baseUrl;
          saveSettings(updated);
          onComplete(proxy.provider, selectedModel || proxy.model);
        } else {
          loginStartedRef.current = false;
          setTimeout(() => setStep("cloud-auth-method"), 3000);
        }
      });
    });
  }, [step]);

  function ensureServing(exec: any, cb: () => void) {
    if (!rt.startServer) { cb(); return; }
    exec(`curl -s ${rt.healthUrl}`, { timeout: 3000 }, (err: any) => {
      if (!err) { cb(); return; }
      setPullProgress(`Starting ${rt.label} server...`);
      exec(`${rt.startServer} &`, { timeout: 3000, shell: "/bin/bash" }, () => {});
      setTimeout(cb, 2500);
    });
  }

  function startPull(model: string) {
    setPullProgress("Checking...");
    setPullPercent(null);
    setStep("pulling");

    import("node:child_process").then(({ exec, spawn }) => {
      ensureServing(exec, () => {
        doPull(model, spawn, exec);
      });
    });
  }

  function doPull(model: string, spawn: any, exec: any) {
    const cmd = rt.pull(model);
    setPullProgress(`Downloading ${model}...`);

    const child = spawn("/bin/bash", ["-c", cmd], { stdio: ["ignore", "pipe", "pipe"] });

    const onData = (d: Buffer) => {
      const text = d.toString().replace(/\r/g, "\n");
      const line = text.trim().split("\n").pop() || "";
      if (!line) return;
      setPullProgress(line.slice(0, 120));
      const pct = parsePullPercent(line);
      if (pct !== null) setPullPercent(pct);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);

    child.on("close", (code: number) => {
      if (code === 0) {
        setPullProgress("Download complete.");
        if (rt.postPull) {
          setPullProgress("Starting model server...");
          exec(rt.postPull(model), { timeout: 30000, shell: "/bin/bash" }, () => {
            finish(model);
          });
        } else {
          finish(model);
        }
      } else {
        setPullProgress(`Download failed. Is ${rt.label} running?`);
        setTimeout(() => setStep("local-model"), 3000);
      }
    });

    child.on("error", () => {
      setPullProgress(`Failed to run ${rt.label}.`);
      setTimeout(() => setStep("local-model"), 3000);
    });
  }

  function finish(model: string) {
    setPullProgress("Finalizing...");
    import("node:child_process").then(({ exec }) => {
      exec(`curl -s ${rt.healthUrl}`, { timeout: 3000 }, (err) => {
        if (err && rt.startServer) {
          exec(`${rt.startServer} &`, { timeout: 3000, shell: "/bin/bash" }, () => {});
        }
        const updated = loadSettings();
        updated.provider = rt.providerId;
        updated.model = model;
        updated.apiKey = rt.apiKey;
        saveSettings(updated);
        setPullProgress("Ready.");
        setTimeout(() => onComplete(rt.providerId, model), 1000);
      });
    });
  }

  if (step === "type") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">How do you want to run models?</Text>
        <Text> </Text>
        <SelectInput
          items={[
            { label: "Cloud   Use an API key (OpenRouter, OpenAI, Anthropic, Gemini, etc.)", value: "cloud" },
            { label: "Local   Run a model on this machine (Ollama, LM Studio, or MLX)", value: "local" },
          ]}
          onSelect={(item) => setStep(item.value === "cloud" ? "cloud-provider" : "local-runtime")}
        />
        <Text> </Text>
        <Text dimColor>Esc to cancel.</Text>
      </Box>
    );
  }

  if (step === "local-runtime") {
    const items: Array<{ label: string; value: LocalRuntime | "back" }> = [
      {
        label: `Ollama       Popular, easy setup${isAppleSilicon ? "  ⚠ known M5 Metal bug" : ""}`,
        value: "ollama",
      },
      {
        label: "LM Studio    GUI + CLI, broad GGUF support, OpenAI-compatible",
        value: "lmstudio",
      },
      {
        label: `MLX          Apple-native, fastest on Apple Silicon${!isAppleSilicon ? "  (Apple Silicon only)" : "  ← recommended for M-series"}`,
        value: "mlx",
      },
    ];
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Which local runtime?</Text>
        <Text dimColor>OpenAgent will auto-install whichever you pick.</Text>
        <Text> </Text>
        <SelectInput
          items={items as any}
          onSelect={(item: any) => {
            const choice = item.value as LocalRuntime;
            if (choice === "mlx" && !isAppleSilicon) {
              setError("MLX requires Apple Silicon (macOS on M-series).");
              return;
            }
            setError("");
            setLocalRuntime(choice);
            setStep("local-check");
          }}
          initialIndex={isAppleSilicon ? 2 : 1}
        />
        {error && <Text color="red">{error}</Text>}
        <Text> </Text>
        <Text dimColor>Esc to go back.</Text>
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
            } else if (selectedProvider === "anthropic-max") {
              setStep("claude-proxy-setup");
            } else if (selectedProvider === "anthropic") {
              setStep("cloud-key");
            } else {
              setStep("cloud-key");
            }
          }}
          initialIndex={Math.max(provider.config.models.findIndex(m => m.id === provider.config.defaultModel), 0)}
        />
      </Box>
    );
  }

  if (step === "claude-proxy-setup") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan"><Spinner type="dots" /> Setting up Claude Max access</Text>
        <Text> </Text>
        <Text color="yellow">{pullProgress || "Checking requirements..."}</Text>
      </Box>
    );
  }

  if (step === "cloud-auth-method") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">How do you want to connect to Claude?</Text>
        <Text> </Text>
        <SelectInput
          items={[
            { label: "Use my Max/Pro subscription (automatic, no API key)", value: "proxy" },
            { label: "Enter an API key manually", value: "key" },
          ]}
          onSelect={(item) => {
            if (item.value === "proxy") {
              setStep("claude-proxy-setup");
            } else {
              setStep("cloud-key");
            }
          }}
        />
      </Box>
    );
  }


  if (step === "claude-login") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan"><Spinner type="dots" /> Logging in to Claude...</Text>
        <Text dimColor>Check your browser for the login page.</Text>
        <Text> </Text>
        <Text color="yellow">{pullProgress || "Opening browser..."}</Text>
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
        <Text color="cyan"><Spinner type="dots" /> Checking for {rt.label}...</Text>
        {(() => {
          import("node:child_process").then(({ exec }) => {
            exec(rt.binCheck, { timeout: 3000, shell: "/bin/bash" } as any, (err) => {
              if (err) {
                setStep("installing-runtime");
              } else {
                setRuntimeInstalled(true);
                setStep("local-model");
              }
            });
          });
          return null;
        })()}
      </Box>
    );
  }

  if (step === "installing-runtime") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{rt.label} not found</Text>
        <Text> </Text>
        <Text>{rt.label} is needed to run local models.</Text>
        <Text> </Text>
        <SelectInput
          items={[
            { label: `Install ${rt.label} automatically`, value: "install" },
            { label: `I'll install it myself (${rt.installUrl})`, value: "skip" },
            { label: "Go back", value: "back" },
          ]}
          onSelect={(item) => {
            if (item.value === "back") { setStep("local-runtime"); return; }
            if (item.value === "skip") { setStep("local-model"); return; }

            setPullProgress(`Installing ${rt.label}...`);
            setStep("pulling");

            import("node:child_process").then(({ exec }) => {
              const platform = process.platform;
              const cmd = platform === "darwin" ? rt.installDarwin : rt.installLinux;

              exec(cmd, { timeout: 180000, shell: "/bin/bash" } as any, (err, stdout, stderr) => {
                if (err) {
                  setPullProgress(`Install failed: ${(stderr || stdout || err.message).slice(0, 200)}`);
                  setTimeout(() => setStep("local-runtime"), 4000);
                  return;
                }
                const afterInstall = () => {
                  setPullProgress(`${rt.label} installed.`);
                  if (rt.startServer) {
                    exec(`${rt.startServer} &`, { timeout: 5000, shell: "/bin/bash" } as any, () => {
                      setRuntimeInstalled(true);
                      setTimeout(() => setStep("local-model"), 1500);
                    });
                  } else {
                    setRuntimeInstalled(true);
                    setTimeout(() => setStep("local-model"), 1500);
                  }
                };
                if (rt.postInstall) {
                  setPullProgress(`Setting up ${rt.label} CLI...`);
                  exec(rt.postInstall, { timeout: 30000, shell: "/bin/bash" } as any, () => afterInstall());
                } else {
                  afterInstall();
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
        <Text bold color="cyan">Pick a model to run via {rt.label}:</Text>
        <Text dimColor>System RAM: {sysRAM}GB {runtimeInstalled === false && <Text color="red">  {rt.label} not found — install from {rt.installUrl}</Text>}</Text>
        <Text> </Text>
        <SelectInput
          items={[
            ...localModels.map(m => ({
              label: `${m.name.padEnd(28)} ${m.size.padEnd(8)} needs ${m.ram}${sysRAM < parseInt(m.ram) ? "  ⚠ may be slow" : ""}`,
              value: m.id,
            })),
            { label: "Enter a custom model name or server URL...", value: "__custom__" },
          ]}
          onSelect={(item) => {
            if (item.value === "__custom__") {
              setStep("local-custom");
              return;
            }
            const model = localModels.find(m => m.id === item.value)!;
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
        <Text dimColor>via {rt.label}</Text>
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
        <Text bold color="cyan">Enter a {rt.label} model name or server URL:</Text>
        <Text dimColor>Model name (e.g. {localModels[0]?.id}) or server (e.g. http://host:{rt.port})</Text>
        <Text> </Text>
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={customHost} onChange={setCustomHost} onSubmit={() => {
          const val = customHost.trim();
          if (!val) return;

          if (val.startsWith("http")) {
            const updated = loadSettings();
            updated.provider = rt.providerId;
            updated.model = localModels[0]?.id || val;
            updated.apiKey = val;
            saveSettings(updated);
            onComplete(rt.providerId, localModels[0]?.id || val);
          } else {
            startPull(val);
          }
        }} placeholder={`${localModels[0]?.id} or http://...`} /></Box>
      </Box>
    );
  }

  if (step === "pulling") {
    const barWidth = 40;
    const pct = pullPercent ?? 0;
    const filledChars = Math.floor((pct / 100) * barWidth);
    const partialIdx = Math.floor(((pct / 100) * barWidth - filledChars) * 8);
    const partials = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];
    const filled = "█".repeat(filledChars);
    const partial = filledChars < barWidth ? partials[partialIdx] : "";
    const empty = "░".repeat(Math.max(0, barWidth - filledChars - (partial ? 1 : 0)));
    const barColor = pct >= 95 ? "green" : pct >= 50 ? "cyan" : "yellow";

    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan"><Spinner type="dots" /> Setting up {rt.label}</Text>
        <Text> </Text>
        {pullPercent !== null ? (
          <Box>
            <Text color={barColor}>{filled}{partial}</Text>
            <Text dimColor>{empty}</Text>
            <Text bold>  {Math.round(pct)}%</Text>
          </Box>
        ) : (
          <Box>
            <Text dimColor>{"░".repeat(barWidth)}</Text>
            <Text dimColor>  —</Text>
          </Box>
        )}
        <Text> </Text>
        <Text color="gray">{pullProgress}</Text>
      </Box>
    );
  }

  return null;
}
