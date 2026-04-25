---
title: LM Studio
parent: Providers
nav_order: 2
---

# LM Studio

[LM Studio](https://lmstudio.ai) provides a polished GUI plus a CLI (`lms`) and an OpenAI-compatible local server.

## Setup

1. Run `openagent --setup`.
2. Choose **Local → LM Studio**.
3. OpenAgent installs LM Studio via `brew install --cask lm-studio` and bootstraps the `lms` CLI.
4. Pick a model from the curated catalog.

## Curated models

These are LM Studio catalog IDs (passed to `lms get`):

| Model | Size | RAM |
|:---|:---|:---|
| `google/gemma-4-e2b` | 1.5 GB | 5 GB |
| `google/gemma-4-e4b` | 3.0 GB | 5 GB |
| `google/gemma-4-26b-a4b` | 15 GB | 18 GB |
| `google/gemma-4-31b` | 18 GB | 20 GB |
| `qwen/qwen3.5-9b` | 5.4 GB | 16 GB |
| `qwen/qwen3.5-35b-a3b` | 20 GB | 24 GB |
| `openai/gpt-oss-20b` | 12 GB | 24 GB |

## Custom models

Paste any LM Studio catalog ID in the **Custom** option:

```
google/gemma-4-e2b@q4_k_m
qwen/qwen3.5-9b
openai/gpt-oss-20b
```

## Server config

LM Studio's server runs on `localhost:1234`. OpenAgent talks to its OpenAI-compatible `/v1/chat/completions` endpoint. To point at a different host, pick **Custom → http://...** in the picker.

## Troubleshooting

**"Failed to resolve artifact"** — the model name isn't in LM Studio's catalog. Use `lms get` (no args) to see the full staff-pick list and pick a valid `publisher/model` ID.
