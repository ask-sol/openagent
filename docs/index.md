---
title: OpenAgent — Open-source Claude Code alternative
nav_title: Home
layout: default
nav_order: 1
description: "OpenAgent is the open-source Claude Code alternative — an agentic coding CLI that works with Claude, GPT-5, Gemini, Ollama, and 12+ AI providers from your terminal. Apache 2.0."
permalink: /
seo:
  type: SoftwareApplication
  name: OpenAgent
---

# OpenAgent
{: .fs-9 }

The open-source agentic coding CLI. Use your existing Claude Max subscription, OpenRouter, GPT-5, Gemini, Ollama, or any of 12 providers — from your terminal.
{: .fs-6 .fw-300 }

[Install](#install){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/ask-sol/openagent){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## What is OpenAgent?

OpenAgent is a terminal-native AI coding agent. It reads your files, writes code, runs commands, searches the web, and ships features — all from the command line. Unlike Claude Code, it isn't locked to a single provider: switch between Claude, GPT-5, Gemini, Grok, Llama, Ollama, MLX, LM Studio, and more with one keystroke.

**Why people use it:**

- **Bring your own model.** Already paying for Claude Max? OpenAgent uses your existing subscription. Want GPT-5 today, Gemini tomorrow? `/model` and switch.
- **Run locally for free.** First-class support for Ollama, LM Studio, and Apple's MLX framework — no API costs, no rate limits, no telemetry.
- **Real agent loop.** Plans, executes, verifies. Not a chat box that occasionally writes code.
- **Open source, Apache 2.0.** Fork it, audit it, self-host it.

## Install

### macOS

```bash
brew install ask-sol/openagent/openagent
```

### Linux / WSL

```bash
curl -fsSL https://raw.githubusercontent.com/ask-sol/openagent/main/scripts/install-remote.sh | bash
```

### From source

```bash
git clone https://github.com/ask-sol/openagent.git
cd openagent
bash scripts/install-user.sh
```

Then run `openagent` and the setup wizard walks you through provider selection, login, and your first model.

[Continue to Quickstart →](/openagent/essentials/quickstart){: .btn .btn-blue }
