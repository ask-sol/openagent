<h1 align="center">OpenAgent</h1>

<p align="center">
  <strong>The open-source Claude Code alternative that works with any AI provider.</strong><br>
  Use your existing Claude Max subscription, OpenRouter, GPT-5, Gemini, Ollama, or any of 12 providers.
</p>

<p align="center">
  <a href="https://github.com/ask-sol/openagent/stargazers"><img src="https://img.shields.io/github/stars/ask-sol/openagent?style=for-the-badge&color=yellow" alt="Stars" /></a>
  <a href="https://github.com/ask-sol/openagent/releases"><img src="https://img.shields.io/github/v/release/ask-sol/openagent?style=for-the-badge&color=green&label=version" alt="Version" /></a>
  <a href="https://github.com/ask-sol/openagent/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ask-sol/openagent?style=for-the-badge&color=blue" alt="License" /></a>
</p>

<!-- stats-start -->
<p align="center">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/ask-sol/openagent?style=for-the-badge&color=yellow&label=stars" />
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/ask-sol/openagent?style=for-the-badge&color=blue&label=forks" />
  <img alt="Release downloads" src="https://img.shields.io/github/downloads/ask-sol/openagent/total?style=for-the-badge&color=brightgreen&label=downloads" />
  <img alt="Total clones" src="https://img.shields.io/badge/clones-1%2C099-9b59b6?style=for-the-badge" />
  <img alt="Unique users" src="https://img.shields.io/badge/unique%20users-377-ec4899?style=for-the-badge" />
</p>

<p align="center"><sub>Tracking since 2026-04-19 • 1,099 clones and 344 unique users in the last 14 days • updated 2026-04-19</sub></p>
<!-- stats-end -->

<p align="center">
  <img src="assets/demo.gif" alt="OpenAgent Demo" width="700" />
</p>

<p align="center">
  <a href="#install">Install</a> •
  <a href="#why-openagent">Why OpenAgent</a> •
  <a href="#providers">Providers</a> •
  <a href="#features">Features</a> •
  <a href="#commands">Commands</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Why OpenAgent?

**Already paying for Claude Max?** OpenAgent lets you use your existing subscription directly — no separate API key, no extra cost. Just log in and code.

**Want provider freedom?** Switch between GPT-5, Claude, Gemini, Grok, DeepSeek, or local models with one command. No lock-in.

**Want something open?** OpenAgent is Apache 2.0 licensed. Fork it, extend it, self-host it.

### OpenAgent vs Claude Code

| | **OpenAgent** | **Claude Code** |
|:---|:---|:---|
| **Providers** | 12+ (OpenAI, Anthropic, Gemini, Groq, Mistral, DeepSeek, xAI, Bedrock, Alibaba, Ollama, OpenRouter) | Anthropic only |
| **Use Max/Pro subscription** | ✅ No API key needed | ✅ Built-in |
| **Run local models** | ✅ Ollama with auto-install & download | ❌ |
| **Cost** | Free + bring your own key | $20/mo minimum |
| **Syntax-highlighted diffs** | ✅ Full language-aware highlighting | ✅ |
| **Terminal mode** | ✅ Ctrl+T for inline shell | ❌ |
| **Web search** | ✅ Built-in | ❌ |
| **Social media posting** | ✅ Reddit & X | ❌ |
| **WhatsApp/Discord bridges** | ✅ | ❌ |
| **Permission modes** | ✅ Standard, Cautious, Unrestricted | ✅ Auto accept edit, Plan mode, Bypass |
| **Real-time cost tracking** | ✅ Live in status bar | ❌ No API cost tracking|
| **Open source** | ✅ Apache 2.0 | Source-available |

---

## Install

**macOS**
```bash
brew install ask-sol/openagent/openagent
```

**Linux / WSL**
```bash
curl -fsSL https://raw.githubusercontent.com/ask-sol/openagent/main/scripts/install-remote.sh | bash
```

**From source**
```bash
git clone https://github.com/ask-sol/openagent.git && cd openagent && bash scripts/install-user.sh
```

**Update**
```bash
openagent --upgrade
```

Then just run `openagent`. The setup wizard walks you through everything.


---

## Built by OpenAgent

One prompt was used to build this website for OpenAgent, made with Opus 4.7 (OpenAgent v0.1.30-20260418)

```website
https://openagent-build.solz-ask.workers.dev
```

---
## Quick Start

```bash
openagent              # Interactive setup on first run
openagent -u           # Unrestricted mode — no permission prompts
openagent -c           # Cautious mode — asks before every action
openagent -t           # Thinking mode
openagent --setup      # Re-run setup wizard
```

---

## Providers

| Provider | Type | What you get |
|:---|:---|:---|
| **Anthropic (Max Plan)** | 🔑 Subscription | **Use your existing Claude Max/Pro plan.** No API key. Claude Opus 4.7, Sonnet 4.6, Haiku 4.5 |
| **OpenRouter** | ☁️ Cloud | **One key, every model.** GPT-5.4, Claude, Gemini, Llama, Mistral, DeepSeek, Grok + 100 more |
| **OpenAI** | ☁️ Cloud | GPT-5.4, GPT-4.1, o3, o4-mini |
| **Anthropic** | ☁️ Cloud | Claude Opus 4.7, Sonnet 4.6, Haiku 4.5 (API key) |
| **Google Gemini** | ☁️ Cloud | Gemini 3.1 Pro, 3 Flash, 2.5 Pro/Flash |
| **AWS Bedrock** | ☁️ Cloud | Claude, Llama, Mistral, Nova on AWS |
| **Mistral** | ☁️ Cloud | Mistral Large 3, Small 4, Codestral |
| **Groq** | ☁️ Cloud | Llama 4 Scout, Llama 3.3 70B, Qwen 3 32B |
| **DeepSeek** | ☁️ Cloud | DeepSeek V3.2, R1 |
| **xAI** | ☁️ Cloud | Grok 4.20 (2M context), Grok Code Fast |
| **Alibaba Cloud** | ☁️ Cloud | Qwen 3 235B, Qwen Max, QwQ 32B |
| **Ollama** | 💻 Local | Any model. Auto-installs Ollama, auto-downloads models, RAM/GPU guidance |

Switch anytime: `/model` opens a categorized picker (Cloud vs Local). API key asked only when needed.

---

## Features

### 🤖 Agentic Coding
Read, write, and edit files. Run shell commands. Search codebases by filename or content. Multi-step tasks execute autonomously with a live task checklist.

### 🔐 Permission Modes
- **Standard** — asks before file writes and commands
- **Cautious** — asks before everything
- **Unrestricted** — full auto (UI turns red as a warning)

Cycle with `Shift+Tab`. Set on launch with `-u` or `-c`.

### 💰 Token Efficient
Concise mode strips AI filler without cutting code quality. `CONTEXT.session` persists knowledge across sessions. `/compact` compresses conversation to free tokens. Real-time token counter in the status bar.

### 🖥️ Terminal Mode
`Ctrl+T` switches the input box to a direct shell. Run `git status`, `npm test`, anything — without the AI. `Ctrl+T` again to switch back.

### 🔍 Web Search
Built-in DuckDuckGo search. The AI automatically searches when it needs current information — no manual prompting needed.

### 🎨 Syntax-Highlighted Diffs
File changes display with full syntax highlighting — keywords, strings, comments all colored by language. Line numbers, `+`/`-` markers, context lines.

### 📱 Messaging Bridges
`/whatsapp` and `/discord` let you receive commands from your phone or a Discord server. The AI processes them and responds.

### 📢 Social Media
`/setup-reddit` and `/setup-x` for posting directly from the terminal.

### 💾 Session Resume
All sessions stored locally. `/resume` picks up where you left off. No cloud, no accounts — your data stays on your machine.

### 🔌 MCP Servers
Connect any MCP-compatible tool server via `~/.openagent/mcp_servers.json`.

---

## Commands

<details>
<summary><strong>70+ built-in commands</strong> (click to expand)</summary>

| Category | Commands |
|:---|:---|
| **General** | `/help` `/exit` `/version` `/doctor` `/upgrade` `/changelog` `/feedback` |
| **Conversation** | `/clear` `/compact` `/copy` |
| **Session** | `/resume` `/context` `/tokens` `/cost` `/export` `/rename` `/tag` `/memory` `/stats` |
| **Git** | `/diff` `/status` `/branch` `/log` `/stash` `/commit` `/smartcommit` `/push` `/pull` `/pr` `/review` |
| **Permissions** | `/permissions` `/mode` |
| **Config** | `/provider` `/model` `/max-tokens` `/config` `/response-mode` `/setup` `/env` `/alias` |
| **Tools** | `/tools` `/mcp` |
| **Files** | `/files` `/pwd` `/find` `/grep` `/cat` `/size` |
| **Shell** | `/run` `/npm` |
| **Dev** | `/test` `/lint` `/build` `/autofix` `/project` `/scaffold` `/refactor` `/explain` `/security` `/perf` `/snippet` `/benchmark` `/deps` `/debug` |
| **Workflow** | `/plan` `/undo` `/rewind` `/todo` |
| **UI** | `/theme` `/vim` `/brief` `/keybindings` |
| **Utility** | `/clipboard` `/image` `/time` `/calc` `/json` `/encode` `/decode` `/uuid` `/hash` `/regex` `/sql` `/diagram` `/translate` `/ip` `/port` `/processes` `/disk` `/open` `/weather` |
| **Social** | `/setup-reddit` `/setup-x` `/reddit` `/tweet` |
| **Bridges** | `/whatsapp` `/discord` |

</details>

---

## Keyboard Shortcuts

| Key | Action |
|:---|:---|
| `Ctrl+T` | Toggle terminal mode |
| `Ctrl+B` | Expand/collapse old messages |
| `Shift+Tab` | Cycle permission mode |
| `Esc` | Interrupt current task |
| `Ctrl+C` | Exit |

---

## Contributing

Contributions are welcome. Check out the [issues](https://github.com/ask-sol/openagent/issues) or open a PR.

If you find OpenAgent useful, please consider giving it a ⭐ — it helps others discover the project.

## License

Apache 2.0
