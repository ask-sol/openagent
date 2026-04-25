<h1 align="center">OpenAgent</h1>

<p align="center">
  <strong>The open-source Claude Code alternative. One terminal, every AI provider.</strong><br>
  Use your Claude Max subscription, GPT-5, Gemini, Grok, or run Llama and Gemma locally with Ollama, MLX, or LM Studio. Free forever. Apache 2.0.
</p>

<p align="center">
  <a href="https://github.com/ask-sol/openagent/stargazers"><img src="https://img.shields.io/github/stars/ask-sol/openagent?style=for-the-badge&color=yellow" alt="GitHub stars" /></a>
  <a href="https://github.com/ask-sol/openagent/releases"><img src="https://img.shields.io/github/v/release/ask-sol/openagent?style=for-the-badge&color=green&label=version" alt="Latest release" /></a>
  <a href="https://github.com/ask-sol/openagent/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ask-sol/openagent?style=for-the-badge&color=blue" alt="Apache 2.0 License" /></a>
</p>

<!-- stats-start -->
<p align="center">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/ask-sol/openagent?style=for-the-badge&color=yellow&label=stars" />
  <img alt="Total clones" src="https://img.shields.io/badge/clones-1%2C580-9b59b6?style=for-the-badge" />
  <img alt="Unique users" src="https://img.shields.io/badge/unique%20users-545-ec4899?style=for-the-badge" />
</p>

<p align="center"><sub>Tracking since 2026-04-19 • 1,580 clones and 471 unique users in the last 14 days • updated 2026-04-25</sub></p>
<!-- stats-end -->

<p align="center">
  <img src="assets/demo.gif" alt="OpenAgent terminal coding agent demo — Claude Code alternative" width="700" />
</p>

<p align="center">
  <a href="#install">Install</a> •
  <a href="#why-openagent">Why</a> •
  <a href="#supported-ai-providers">Providers</a> •
  <a href="#local-models-free-zero-api-spend">Local Models</a> •
  <a href="#features">Features</a> •
  <a href="#plugins">Plugins</a> •
  <a href="#mcp-servers">MCP</a> •
  <a href="#faq">FAQ</a> •
  <a href="https://ask-sol.github.io/openagent/">Docs</a>
</p>

---

## What is OpenAgent?

**OpenAgent** is a free, open-source agentic coding CLI that brings Claude-Code-style AI pair programming to your terminal — without locking you into a single provider. It's a drop-in alternative to Claude Code, Cursor, Cline, and Aider that works with **12+ AI providers**: Claude (including direct Claude Max subscription support), OpenAI GPT-5, Google Gemini, xAI Grok, DeepSeek, Mistral, Groq, AWS Bedrock, and local models via Ollama, LM Studio, and Apple's MLX framework.

If you already pay for Claude Max or Pro, OpenAgent uses your subscription directly — no API key, no extra billing. If you'd rather run models locally for free, the setup wizard installs Ollama, LM Studio, or MLX and downloads your first model in two minutes.

---

## Why OpenAgent?

**You already pay for Claude Max.** Use your subscription instead of paying twice. OpenAgent is the only open-source coding agent that talks to your Max plan directly with no separate API key.

**You want provider freedom.** Switch between Claude Opus 4.7, GPT-5, Gemini 3.1 Pro, Grok 4.20, Llama 3.3, Qwen 2.5 Coder, and more with one slash command. No vendor lock-in.

**You want to run AI on your own hardware.** First-class support for Ollama, LM Studio, and MLX (Apple Silicon native, fastest on M-series). Run Gemma 4, Llama 3.1, or DeepSeek Coder V2 with $0 in API spend.

**You want it open.** Apache 2.0. Read the source, fork it, audit it, self-host it. No telemetry. Your sessions, keys, and history stay on your machine.

### OpenAgent vs Claude Code, Cursor, Aider

| | **OpenAgent** | **Claude Code** | **Cursor** | **Aider** |
|:---|:---|:---|:---|:---|
| **License** | Apache 2.0 | Source-available | Closed | Apache 2.0 |
| **Claude Max subscription** | ✅ Direct | ✅ Built-in | ❌ | ❌ |
| **Provider count** | 12+ | 1 (Anthropic) | 3-4 | 8+ |
| **Local models (Ollama / MLX / LM Studio)** | ✅ Auto-install | ❌ | ❌ | ✅ Ollama only |
| **Terminal-native** | ✅ | ✅ | ❌ Editor | ✅ |
| **Plugin store** | ✅ Built-in | ❌ | Limited | ❌ |
| **MCP server store** | ✅ Curated catalog | Manual config | ❌ | ❌ |
| **Live cost tracking** | ✅ Real billing, ticks live | ❌ | ❌ | Estimate |
| **Session resume** | ✅ Local sessions | ✅ | ✅ | ✅ |
| **Pricing** | Free + your key | $20/mo minimum | $20/mo minimum | Free + your key |

---

## Install

**macOS** (Homebrew):

```bash
brew install ask-sol/openagent/openagent
```

**Linux / WSL**:

```bash
curl -fsSL https://raw.githubusercontent.com/ask-sol/openagent/main/scripts/install-remote.sh | bash
```

**From source** (any platform):

```bash
git clone https://github.com/ask-sol/openagent.git
cd openagent
bash scripts/install-user.sh
```

**Update**:

```bash
openagent --upgrade
```

Then run `openagent` and the setup wizard handles everything: provider choice, login, first model.

---

## Quick Start

```bash
openagent              # Interactive setup on first run
openagent -u           # Unrestricted mode (no permission prompts)
openagent -c           # Cautious mode (asks before every action)
openagent -t           # Thinking mode
openagent --setup      # Re-run setup wizard
openagent --upgrade    # Pull the latest release
```

In a session:

```
> add a /health endpoint to server.ts that returns { ok: true }
```

OpenAgent reads your code, plans the change in a live todo list, applies a syntax-highlighted diff, runs your tests if present, and reports what changed.

---

## Supported AI Providers

OpenAgent currently supports **12 cloud and local AI providers**. Switch any time with `/provider` or `/model`.

### Cloud providers

| Provider | Models | Auth |
|:---|:---|:---|
| **Anthropic (Max plan)** | Claude Opus 4.7, Sonnet 4.6, Haiku 4.5 | Subscription, no API key |
| **Anthropic (API)** | Claude Opus 4.7, Sonnet 4.6, Haiku 4.5 | API key |
| **OpenAI** | GPT-5.5, GPT-5.5 Pro, GPT-5.4, GPT-4.1, o3, o3-mini | API key |
| **OpenRouter** | 100+ models, one key | API key |
| **Google Gemini** | Gemini 3.1 Pro, 3 Flash, 2.5 Pro/Flash | API key |
| **xAI** | Grok 4.20, Grok 4.20 Reasoning, Grok Code Fast | API key |
| **Mistral** | Mistral Large 3, Codestral, Small 4 | API key |
| **Groq** | Llama 3.3 70B, Llama 4 Scout, Qwen 3 32B, DeepSeek R1 | API key |
| **DeepSeek** | DeepSeek V3.2, R1 | API key |
| **AWS Bedrock** | Claude, Llama, Mistral, Nova on AWS | IAM |
| **Alibaba Cloud** | Qwen 3 235B, Qwen Max, QwQ 32B | API key |

### Local Models (free, zero API spend)

| Runtime | Best for | Models |
|:---|:---|:---|
| **MLX** (Apple Silicon) | Fastest on M-series Macs | Gemma 4 (E2B/E4B/26B/31B), Llama 3.x, Qwen 2.5 Coder, Mistral, DeepSeek Coder |
| **Ollama** | Cross-platform, biggest catalog | Llama 3.3 70B, Qwen 2.5 Coder, Mistral, DeepSeek Coder V2 |
| **LM Studio** | GUI + CLI, GGUF models | Gemma 4, Qwen 3.5, GPT-OSS 20B, Llama 3.x |

> **M5 Mac note:** Ollama has a known [bug on M5 hardware](https://github.com/ollama/ollama/issues/14432). OpenAgent's MLX provider bypasses it by talking to `mlx_lm.server` directly. If you're on an M5, pick MLX in setup.

---

## Features

### Agentic Coding
Reads, writes, and edits files. Runs shell commands. Searches codebases by filename or content. Multi-step tasks execute autonomously with a live structured todo list.

### Permission Modes
**Standard** asks before file writes and commands. **Cautious** asks before every tool call. **Unrestricted** runs everything without prompting (UI turns red). Cycle with `Shift+Tab`.

### Live Cost Tracking
Real-time token and dollar counter in the status bar. Reads actual `usage` from each provider's stream and reconciles against authoritative billing at message end. No 60% undercount like character-based estimates.

### Syntax-Highlighted Diffs
File edits display the same way Claude Code shows them: numbered lines, red removed `-` markers, green added `+` markers, ±3 lines context, full language-aware syntax highlighting on context lines.

### Token Efficient by Default
Concise system prompt strips AI filler. Streamed text is filtered client-side for internal markers. Result: ~30% fewer output tokens vs. an unfiltered Claude Code session on the same task.

### Terminal Mode
`Ctrl+T` switches the input box to a direct shell — run `git status`, `npm test`, anything — without involving the AI. `Ctrl+T` again to switch back.

### Web Search
Built-in search. The agent automatically searches when it needs current info, documentation, or facts outside its training.

### Session Resume
All sessions stored locally in `~/.openagent/sessions/`. `/resume` picks up where you left off. No cloud, no accounts.

### Messaging Bridges
`/whatsapp` and `/discord` set up webhook bridges so you can send commands from your phone or a Discord server.

### Social Posting
`/setup-reddit` and `/setup-x` connect Reddit and X for posting directly from the terminal.

---

## Plugins

Run `/plugins` to open the plugin store. Toggle bundled plugins on/off, each one adds new tools the agent can call.

| Plugin | Purpose |
|:---|:---|
| **Auto Format** | Format code with prettier, biome, ruff, rustfmt, or gofmt |
| **Linter** | Find and fix code style issues automatically |
| **Tests** | Run your project's tests with one command |
| **Test Coverage** | See which files have weak test coverage |
| **Error Tracer** | Paste a stack trace, see the actual broken code |
| **Snapshot** | Save a backup before risky edits, restore in one click |
| **Commit Helper** | Reads your staged diff so the agent writes a clean message |
| **Code History** | Why does this line look this way? Blame + commit messages |
| **Env Checker** | Find env vars your code uses but forgot to set in `.env` |
| **Security Scan** | Find vulnerable packages in your dependencies |

> **Want your plugin in the bundled set?** Open a PR. See [docs/plugins](https://ask-sol.github.io/openagent/plugins/) for the format. Reviewed and merged on a rolling basis.

---

## MCP Servers

Run `/mcp` to open the Model Context Protocol manager. Three tabs:

- **Store** — curated catalog with one-click install: `filesystem`, `git`, `github`, `postgres`, `sqlite`, `puppeteer`, `fetch`, `brave-search`, `slack`, `memory`
- **Installed** — see what's configured, live connection status, remove servers
- **Custom** — 4-step form (id → command → args → env) for any server not in the catalog

All configs live in `~/.openagent/mcp_servers.json`. Edit directly if you prefer.

> **Built an MCP server?** Open a PR to add it to the curated Store catalog. See [docs/mcp](https://ask-sol.github.io/openagent/mcp/) for the format. Reviewed on a rolling basis.

---

## Slash Commands

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
| **Tools** | `/tools` `/mcp` `/plugins` |
| **Files** | `/files` `/pwd` `/find` `/grep` `/cat` `/size` |
| **Shell** | `/run` `/npm` |
| **Dev** | `/test` `/lint` `/build` `/autofix` `/project` `/scaffold` `/refactor` `/explain` `/security` `/perf` `/snippet` `/benchmark` `/deps` `/debug` |
| **Workflow** | `/plan` `/undo` `/rewind` `/todo` |
| **UI** | `/theme` `/vim` `/brief` `/keybindings` |
| **Utility** | `/clipboard` `/image` `/time` `/calc` `/json` `/encode` `/decode` `/uuid` `/hash` `/regex` `/sql` `/diagram` `/translate` `/ip` `/port` `/processes` `/disk` `/open` `/weather` |
| **Social** | `/setup-reddit` `/setup-x` `/reddit` `/tweet` |
| **Bridges** | `/whatsapp` `/discord` |

</details>

Full reference: [docs.openagent → Commands](https://ask-sol.github.io/openagent/reference/commands).

---

## Keyboard Shortcuts

| Key | Action |
|:---|:---|
| `↑` / `↓` | Cycle through previous prompts |
| `Esc` | Interrupt current task / close menu |
| `Ctrl+T` | Toggle terminal mode (inline shell) |
| `Ctrl+B` | Expand/collapse old messages |
| `Shift+Tab` | Cycle permission mode |
| `Ctrl+C` | Exit |

---

## FAQ

### Is OpenAgent free?
Yes. OpenAgent itself is Apache 2.0 and free forever. You only pay for whatever AI provider you choose, or $0 if you run local models.

### Can I use OpenAgent with my Claude Max subscription?
Yes. OpenAgent talks to the `claude` CLI subprocess that ships with Claude Code. Pick "Anthropic (Max plan)" in setup, no separate API key needed.

### Is OpenAgent the same as Claude Code?
No. Claude Code is Anthropic's source-available CLI that only works with Anthropic models. OpenAgent is open-source (Apache 2.0) and works with 12+ providers including Anthropic, OpenAI, Google, xAI, local models, and more.

### How does OpenAgent compare to Cursor?
Cursor is a closed-source IDE built on VS Code. OpenAgent is an open-source terminal CLI. If you live in the terminal and want provider freedom, OpenAgent fits. If you want a visual IDE, use Cursor.

### How does OpenAgent compare to Aider?
Aider is great and also Apache 2.0. OpenAgent has more provider integrations, a built-in plugin and MCP store, live cost tracking, and a richer TUI with permission modes and todo lists.

### Does OpenAgent run local models?
Yes, with first-class support. Three runtimes are supported: Ollama, LM Studio, and Apple's MLX framework. The setup wizard installs whichever you pick and downloads your first model.

### Does OpenAgent work on Windows?
Linux/WSL works. Native Windows is on the roadmap.

### Does OpenAgent send my code anywhere?
Only to whichever AI provider you've configured. No telemetry, no analytics, no third-party calls. API keys and OAuth tokens are stored in `~/.openagent/` with user-only permissions.

### How do I rank a custom plugin?
See [docs/plugins](https://ask-sol.github.io/openagent/plugins). Each plugin is a `Tool` object with a name, JSON schema, and `execute` function. Drop one in `src/plugins/builtin/` and add it to `BUILTIN_PLUGINS`.

### Can I connect MCP servers?
Yes. Run `/mcp` to browse the curated catalog (filesystem, git, github, postgres, slack, puppeteer, fetch, brave-search, memory, etc.) or add custom servers in `~/.openagent/mcp_servers.json`.

---

## Community

OpenAgent has a community catalog for plugins and MCP servers. If you've built one you want shipped to every OpenAgent user, open a pull request.

**Submit a plugin:** add `src/plugins/builtin/<your-plugin>.ts` exporting a `Plugin` object, register it in `BUILTIN_PLUGINS`. Full guide: [docs/plugins](https://ask-sol.github.io/openagent/plugins/).

**Submit an MCP server:** add an entry to `src/mcp/catalog.ts` with command, args, and any required env vars. Full guide: [docs/mcp](https://ask-sol.github.io/openagent/mcp/).

PRs are reviewed on a rolling basis. Anything that's actively maintained, solves a real developer problem, and works on macOS + Linux is likely to land. Submit a [draft PR](https://github.com/ask-sol/openagent/compare) if you want feedback before the full implementation.

## Contributing

PRs welcome for bugs, features, plugins, and MCP servers. Open an [issue](https://github.com/ask-sol/openagent/issues) first for anything substantial so we can talk about scope.

If OpenAgent saves you time or money, consider giving it a ⭐ — it helps others discover the project.

## License

Apache 2.0. See [LICENSE](LICENSE).

---

<p align="center"><sub>OpenAgent — open-source AI coding agent for the terminal. Works with Claude, GPT-5, Gemini, Grok, DeepSeek, Mistral, Llama, Gemma, Qwen, and more.</sub></p>
