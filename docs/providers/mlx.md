---
title: MLX
parent: Providers
nav_order: 3
---

# MLX

[MLX](https://github.com/ml-explore/mlx-lm) is Apple's native ML framework for Apple Silicon. On M-series Macs it consistently outperforms GGUF runtimes.

> **Tip** If you're on an M5 Mac and Ollama crashes with *"llama runner process has terminated"*, MLX bypasses the bug entirely.
{: .tip }

## Setup

1. Run `openagent --setup`.
2. Choose **Local → MLX**.
3. OpenAgent runs `pip3 install --user mlx-lm` and starts a server on `localhost:8080`.

Requires Python 3 and Apple Silicon (M1+).

## Curated models

| Model | Size | RAM |
|:---|:---|:---|
| `mlx-community/gemma-4-e2b-it-4bit` | 1.5 GB | 5 GB |
| `mlx-community/gemma-4-e4b-it-4bit` *(default)* | 3.0 GB | 5 GB |
| `mlx-community/gemma-4-26b-a4b-it-4bit` | 15 GB | 18 GB |
| `mlx-community/gemma-4-31b-it-4bit` | 18 GB | 20 GB |
| `mlx-community/Llama-3.2-3B-Instruct-4bit` | 1.8 GB | 8 GB |
| `mlx-community/Meta-Llama-3.1-8B-Instruct-4bit` | 4.5 GB | 16 GB |
| `mlx-community/Qwen2.5-Coder-7B-Instruct-4bit` | 4.3 GB | 16 GB |
| `mlx-community/Qwen2.5-Coder-32B-Instruct-4bit` | 18 GB | 32 GB |
| `mlx-community/DeepSeek-Coder-V2-Lite-Instruct-4bit` | 9.0 GB | 24 GB |

## Custom models

Any model from the [`mlx-community` Hugging Face org](https://huggingface.co/mlx-community) works. Paste the full repo path in the **Custom** option.

## How it runs

OpenAgent starts the MLX server in the background:

```bash
nohup python3 -m mlx_lm.server --model <id> --port 8080 > /tmp/openagent-mlx.log 2>&1 &
```

The server is OpenAI-compatible on `/v1/chat/completions`. Logs land in `/tmp/openagent-mlx.log`.

## Limitations

- **Tool use is best-effort** — MLX's function-calling support varies by model. For agentic coding work, prefer Ollama or LM Studio if you can.
- **One model at a time** — switching models requires restarting the server. The picker handles this automatically.
