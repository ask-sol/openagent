---
title: Quickstart
parent: Essentials
nav_order: 1
---

# Quickstart
{: .no_toc }

Get OpenAgent running and edit your first file in under two minutes.
{: .fs-5 .fw-300 }

1. TOC
{:toc}

---

## 1. Install

```bash
brew install ask-sol/openagent/openagent
```

Or see [Install](/openagent/essentials/install) for Linux, WSL, and from-source instructions.

## 2. First run

```bash
openagent
```

The setup wizard asks two questions:

1. **How do you want to run models?** — Cloud (an API provider) or Local (Ollama / LM Studio / MLX).
2. **Which model?** — pick one from the curated list, or paste an OpenRouter ID.

If you have a Claude Max or Pro subscription, pick **Anthropic (Max Plan)** — no API key needed.

## 3. Ask it to do something

```
> add a /health endpoint to server.ts that returns { ok: true }
```

OpenAgent will:

1. Read `server.ts`.
2. Plan the edit and show you a `TodoWrite` list.
3. Apply the edit (you'll see a syntax-highlighted diff).
4. Run any tests it finds.
5. Summarize what changed.

## 4. Common shortcuts

| Key | Action |
|:---|:---|
| `↑` / `↓` | Cycle through previous prompts |
| `Esc` | Stop the current task / close menus / dismiss prompts |
| `Ctrl+T` | Toggle terminal mode (run shell commands inline) |
| `Shift+Tab` | Cycle permission mode (Standard → Cautious → Unrestricted) |
| `Ctrl+C` | Quit |

## 5. Next steps

- **[Providers](/openagent/providers)** — switch between Claude, GPT-5, Gemini, Ollama, and more.
- **[Plugins](/openagent/plugins)** — extend the agent with linters, test runners, snapshot rollbacks.
- **[MCP](/openagent/mcp)** — connect Model Context Protocol servers (filesystem, GitHub, Postgres, Slack, etc.).
- **[Commands](/openagent/reference/commands)** — full reference for the 70+ slash commands.
