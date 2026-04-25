---
title: Providers
nav_order: 3
has_children: true
---

# Providers

OpenAgent works with 12+ AI providers. Switch any time with `/provider` or `/model`.

## Cloud providers

| Provider | Auth | Notable models |
|:---|:---|:---|
| **Anthropic (Max plan)** | Subscription, no API key | Claude Opus 4.7, Sonnet 4.6, Haiku 4.5 |
| **Anthropic (API)** | API key | Same models |
| **OpenAI** | API key | GPT-5.5, GPT-5.4, o3, o3-mini |
| **OpenRouter** | API key | 100+ models, one key |
| **Google Gemini** | API key | Gemini 3.1 Pro, Gemini 3 Flash |
| **xAI** | API key | Grok 4.20, Grok Code Fast |
| **Mistral** | API key | Mistral Large, Codestral |
| **Groq** | API key | Llama 3.3 70B, Qwen 3 32B |
| **DeepSeek** | API key | DeepSeek V3, R1 |
| **AWS Bedrock** | IAM | Claude, Llama, Nova on AWS |
| **Alibaba Cloud** | API key | Qwen 3 235B, QwQ 32B |

## Local runtimes

| Runtime | Install | Best for |
|:---|:---|:---|
| **[Ollama](/openagent/providers/ollama)** | `brew install ollama` | Easiest setup, broad model catalog |
| **[LM Studio](/openagent/providers/lmstudio)** | `brew install --cask lm-studio` | GUI + CLI, GGUF models |
| **[MLX](/openagent/providers/mlx)** | `pip install mlx-lm` | Apple Silicon native, fastest on M-series |

## Switching

```
/provider     # picker for provider + model + key
/model        # change just the model (same provider)
```

Or override at launch:

```bash
openagent --provider anthropic --model claude-opus-4-7
```

> **Tip** If you already pay for Claude Max or Pro, pick `Anthropic (Max plan)` during setup — OpenAgent will use your subscription directly, no API key needed.
{: .tip }
