---
title: Ollama
parent: Providers
nav_order: 1
---

# Ollama

[Ollama](https://ollama.com) is the easiest way to run open-source models locally.

## Setup

OpenAgent's setup wizard auto-detects and installs Ollama on first use:

1. Run `openagent --setup`.
2. Choose **Local → Ollama**.
3. Pick a model — OpenAgent will install Ollama (via Homebrew on macOS, the official script on Linux), download the model, and start the server.

## Manual setup

If you already have Ollama:

```bash
ollama serve &
ollama pull llama3.2
openagent --provider ollama --model llama3.2:latest
```

## Curated models

| Model | Size | RAM |
|:---|:---|:---|
| Llama 3.2 3B | 2.0 GB | 8 GB |
| Llama 3.1 8B | 4.7 GB | 16 GB |
| Qwen 2.5 Coder 7B | 4.7 GB | 16 GB |
| Mistral 7B | 4.1 GB | 16 GB |
| DeepSeek Coder V2 16B | 8.9 GB | 24 GB |
| Qwen 2.5 Coder 32B | 19 GB | 32 GB |
| Llama 3.3 70B | 40 GB | 64 GB+ |

## Custom server

If you run Ollama on another machine:

```
/model     → Local → Ollama → Custom → http://192.168.1.5:11434
```

## Known issue: Apple M5

If you're on an M5 Mac and `ollama run` returns *"llama runner process has terminated"*, you're hitting an upstream Ollama bug ([#14432](https://github.com/ollama/ollama/issues/14432)) where its MLX bindings have a `bf16`/`f16` mismatch that Metal 4 rejects. **Workaround:** switch to OpenAgent's [MLX](/openagent/providers/mlx) runtime — it uses Apple's MLX directly and bypasses the bug.
