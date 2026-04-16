# OpenAgent

Open-source agentic coding CLI for your terminal. Multi-provider, token-efficient, extensible.

```
   ____                   ___                    __
  / __ \____  ___  ____  /   | ____ ____  ____  / /_
 / / / / __ \/ _ \/ __ \/  /| |/ __ `/ _ \/ __ \/ __/
/ /_/ / /_/ /  __/ / / / ___ / /_/ /  __/ / / / /_
\____/ .___/\___/_/ /_/_/  |_\__, /\___/_/ /_/\__/
    /_/                     /____/
```

## Install

```bash
# Clone and install
git clone https://github.com/ask-sol/openagent.git
cd openagent
npm install

# Install globally (no sudo needed)
bash scripts/install-user.sh

# Run from anywhere
openagent
```

## Features

- **9 Providers** — OpenRouter, OpenAI, Anthropic, Google Gemini, Mistral, Groq, DeepSeek, xAI, Ollama
- **Agentic Coding** — Read, write, edit files, run commands, search codebases
- **Web Search** — Built-in DuckDuckGo search and URL fetching
- **MCP Servers** — Connect to any MCP-compatible tool server
- **Reddit & X Posting** — Post directly from your terminal with `/setup-reddit` and `/setup-x`
- **Local Session Resume** — Pick up where you left off, no cloud needed
- **CONTEXT.session** — Persistent memory across sessions per project
- **Permission Modes** — Standard (asks before writes), Cautious (asks everything), Unrestricted (no prompts)
- **Token Efficient** — Concise mode cuts filler, saves tokens without cutting code quality
- **50+ Slash Commands** — Git, files, dev tools, utilities, config, and more
- **Terminal Responsive** — Adapts to terminal resize instantly

## Usage

```bash
openagent              # Start with standard permissions
openagent -u           # Unrestricted mode (no permission prompts)
openagent -c           # Cautious mode (asks before every tool)
openagent -t           # Enable thinking mode
openagent --setup      # Re-run setup wizard
openagent --sessions   # List previous sessions
```

## Commands

| Category | Commands |
|---|---|
| General | `/help` `/exit` `/version` `/doctor` |
| Session | `/resume` `/clear` `/compact` `/tokens` `/context` `/export` |
| Git | `/diff` `/status` `/branch` `/log` `/commit` `/push` `/pull` `/pr` `/stash` |
| Config | `/provider` `/model` `/config` `/response-mode` `/setup` |
| Permissions | `/permissions` `/mode` |
| Files | `/files` `/find` `/grep` `/cat` `/size` |
| Dev | `/test` `/lint` `/build` `/deps` `/benchmark` `/snippet` |
| Social | `/setup-reddit` `/setup-x` `/reddit` `/tweet` |
| Utility | `/run` `/calc` `/uuid` `/hash` `/ip` `/port` `/time` `/weather` |

## Providers

One API key per provider. OpenRouter gives you access to all major models with a single key.

| Provider | Models |
|---|---|
| OpenRouter | GPT-4.1, Claude Opus 4, Gemini 2.5 Pro, Llama, Mistral, DeepSeek, Grok, and 100+ more |
| OpenAI | GPT-4.1, GPT-4o, o3, o4-mini |
| Anthropic | Claude Opus 4, Sonnet 4, Haiku 3.5 |
| Google Gemini | Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash |
| Mistral | Mistral Large, Codestral, Small |
| Groq | Llama 3.3 70B, DeepSeek R1, Gemma, Mixtral |
| DeepSeek | DeepSeek V3, R1 |
| xAI | Grok 3, Grok 3 Mini |
| Ollama | Any local model |

## Config

Settings stored at `~/.openagent/config.json`. Sessions stored at `~/.openagent/sessions/`.

## License

MIT
