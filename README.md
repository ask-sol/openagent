<p align="center">
  <strong>Open-source agentic coding CLI for your terminal.</strong><br>
  Multi-provider. Token-efficient. Extensible.
</p>

<p align="center">
  <a href="https://github.com/ask-sol/openagent/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ask-sol/openagent?style=flat-square&color=blue" alt="License" /></a>
  <a href="https://github.com/ask-sol/openagent/releases"><img src="https://img.shields.io/github/v/release/ask-sol/openagent?style=flat-square&color=green&label=version" alt="Version" /></a>
  <a href="https://github.com/ask-sol/openagent/stargazers"><img src="https://img.shields.io/github/stars/ask-sol/openagent?style=flat-square&color=yellow" alt="Stars" /></a>
  <a href="https://github.com/ask-sol/openagent/issues"><img src="https://img.shields.io/github/issues/ask-sol/openagent?style=flat-square&color=red" alt="Issues" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square" alt="Node" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/providers-10-blueviolet?style=flat-square" alt="Providers" />
  <img src="https://img.shields.io/badge/commands-70%2B-orange?style=flat-square" alt="Commands" />
</p>

<p align="center">
  <img src="assets/demo.gif" alt="OpenAgent Demo" width="700" />
</p>

---

## OpenAgent vs Claude Code

| | **OpenAgent** | **Claude Code** |
|:---|:---|:---|
| **Providers** | 10 — OpenRouter, OpenAI, Anthropic, Gemini, Groq, Mistral, DeepSeek, xAI, AWS Bedrock, Ollama | Anthropic only |
| **Local models** | Ollama with guided setup, RAM/GPU suggestions | No |
| **Cost** | Free + bring your own key | $20/mo subscription |
| **Token saving** | Concise mode, CONTEXT.session persistence, /compact | Manual |
| **Permission modes** | Standard, Cautious, Unrestricted (with visual theme change) | Bypass only |
| **Terminal mode** | Ctrl+T to run commands directly | No |
| **Web search** | Built-in DuckDuckGo | No |
| **Social media** | Reddit + X posting | No |
| **Messaging bridges** | WhatsApp, Discord | No |
| **Session resume** | Local, no cloud | Cloud-based |
| **Cost tracking** | Per-model live estimates in status bar | No |
| **Open source** | MIT | Source-available |

---

## Install

**macOS (Homebrew)**
```bash
brew install ask-sol/openagent/openagent
```

**Linux / WSL**
```bash
curl -fsSL https://raw.githubusercontent.com/ask-sol/openagent/main/scripts/install-remote.sh | bash
```

**Manual**
```bash
git clone https://github.com/ask-sol/openagent.git && cd openagent && bash scripts/install-user.sh
```

**Update**
```bash
openagent --upgrade
```

---

## Quick Start

```bash
openagent           # First run → setup wizard
openagent -u        # Unrestricted (no permission prompts)
openagent -c        # Cautious (asks before everything)
openagent -t        # Thinking mode
```

---

## Providers

| Provider | Type | Models |
|:---|:---|:---|
| **OpenRouter** | Cloud | GPT-4.1, Claude Opus 4, Gemini 2.5 Pro, Llama, Mistral, DeepSeek, Grok + 100 more |
| **OpenAI** | Cloud | GPT-4.1, GPT-4o, o3, o4-mini |
| **Anthropic** | Cloud | Claude Opus 4, Sonnet 4, Haiku 3.5 |
| **Google Gemini** | Cloud | Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash |
| **AWS Bedrock** | Cloud | Claude, Llama, Mistral, Nova on AWS |
| **Mistral** | Cloud | Mistral Large, Codestral, Small |
| **Groq** | Cloud | Llama 3.3 70B, DeepSeek R1, Mixtral |
| **DeepSeek** | Cloud | DeepSeek V3, R1 |
| **xAI** | Cloud | Grok 3, Grok 3 Mini |
| **Ollama** | Local | Any model — Llama, Qwen, CodeLlama, Mistral |

Switch anytime with `/model` — categorized picker (Cloud vs Local), asks for API key when needed.

---

## Features

**Agentic coding** — Read, write, edit files. Run commands. Search codebases. Multi-step tasks run autonomously.

**Permission modes** — Standard (asks before writes), Cautious (asks everything), Unrestricted (full auto). Shift+Tab to cycle. Unrestricted turns the UI red as a visual warning.

**Token efficient** — Concise mode strips filler from responses. CONTEXT.session persists knowledge across sessions. `/compact` compresses conversation to free tokens.

**Terminal mode** — Ctrl+T switches the input to a direct shell. Run commands without the AI. Ctrl+T back.

**Web search** — Built-in DuckDuckGo. AI searches, reads pages, synthesizes answers.

**Messaging bridges** — `/whatsapp` and `/discord` to receive commands from your phone or server.

**Social media** — `/setup-reddit` and `/setup-x` for posting from the terminal.

**Session resume** — All sessions stored locally. `/resume` to pick up where you left off.

**MCP servers** — Connect any MCP-compatible tool server via `~/.openagent/mcp_servers.json`.

**Cost tracking** — Live per-model cost estimate in the status bar.

---

## Commands

<details>
<summary><strong>70+ built-in commands</strong></summary>

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
| **Ctrl+T** | Toggle terminal mode |
| **Ctrl+B** | Expand/collapse old messages |
| **Shift+Tab** | Cycle permission mode |
| **Esc** | Interrupt current task |
| **Ctrl+C** | Exit |

---

## Contributing

Contributions welcome. Open an issue or PR.

## License

MIT
