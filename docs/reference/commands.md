---
title: Commands
parent: Reference
nav_order: 1
---

# Slash Commands
{: .no_toc }

OpenAgent ships with 70+ built-in slash commands. Type `/` in the prompt to autocomplete. `/help` lists everything.

1. TOC
{:toc}

---

## General

| Command | Description |
|:---|:---|
| `/help` | List all commands; `/help <name>` for details on one |
| `/exit` | Quit OpenAgent |
| `/version` | Print version |
| `/doctor` | Run diagnostics (auth, tool tests, network) |
| `/upgrade` | Upgrade via Homebrew with a live progress bar |
| `/changelog` | Show recent release notes |
| `/feedback` | Open the feedback form |

## Conversation

| Command | Description |
|:---|:---|
| `/clear` | Wipe the current session and start fresh |
| `/compact` | Summarize the conversation to free up context |
| `/copy` | Copy the last assistant message to clipboard |

## Session

| Command | Description |
|:---|:---|
| `/resume` | Pick a previous session in this directory and continue |
| `/context` | Show what's currently in the model's context |
| `/tokens` | Show token usage for this session |
| `/cost` | Show estimated cost so far |
| `/export` | Export the conversation to markdown |
| `/rename` | Rename the current session |
| `/tag` | Add a tag to the current session |
| `/memory` | Browse / edit persistent memory |
| `/stats` | Aggregate session stats (count, tokens, cost) |

## Configuration

| Command | Description |
|:---|:---|
| `/provider` | Switch provider (opens picker) |
| `/model` | Switch model (opens picker) |
| `/max-tokens` | Set max output tokens |
| `/config` | Print all settings |
| `/response-mode` | Toggle Concise vs Explanative |
| `/setup` | Re-run the setup wizard |
| `/env` | Manage environment variables |
| `/alias` | Define a shell-style alias |

## Permissions

| Command | Description |
|:---|:---|
| `/permissions` | Open the permission rules editor |
| `/mode` | Print current permission mode |

## Tools & Plugins

| Command | Description |
|:---|:---|
| `/tools` | List active tools (built-ins + enabled plugins + MCP) |
| `/plugins` | Open the plugin store |
| `/mcp` | Open the MCP server store |
| `/mcp-status` | List currently-connected MCP servers |

## Files

| Command | Description |
|:---|:---|
| `/files` (alias `/ls`) | List files in current directory |
| `/pwd` | Print working directory |
| `/find <name>` | Find files by name (glob) |
| `/grep <pattern>` | Search file contents |
| `/cat <file>` | Print a file |
| `/size <path>` | File / dir size |

## Shell

| Command | Description |
|:---|:---|
| `/run <cmd>` | Run a shell command (also: Ctrl+T toggles terminal mode) |
| `/npm <args>` | Run an npm command |

## Dev

| Command | Description |
|:---|:---|
| `/test` | Run the project's test suite |
| `/lint` | Run the linter |
| `/build` | Run the build |
| `/autofix` | Run autofix tools (eslint --fix, ruff --fix, etc.) |
| `/project` | Detect & summarize the project type |
| `/scaffold` | Scaffold a new project |
| `/refactor <area>` | Ask the agent to refactor |
| `/explain <area>` | Ask the agent to explain code |
| `/security` | Run a security review |
| `/perf` | Suggest performance improvements |
| `/snippet` | Save the last code block as a reusable snippet |
| `/benchmark` | Time a command repeatedly |
| `/deps` | List dependencies |
| `/debug` | Network and provider diagnostics |

## Git

| Command | Description |
|:---|:---|
| `/diff` | Show working-tree diff |
| `/status` | Working-tree status |
| `/branch` | List / switch branches |
| `/log` | Recent commits |
| `/stash` | Stash changes |
| `/commit` | Commit (asks for message) |
| `/smartcommit` | Generate a commit message from the diff |
| `/push` | Push to remote |
| `/pull` | Pull from remote |
| `/pr` | Open a PR (uses `gh`) |
| `/review` | Ask the agent to review the diff |

## Workflow

| Command | Description |
|:---|:---|
| `/plan` | Have the agent plan before executing |
| `/undo` | Revert the last change |
| `/rewind <n>` | Rewind n turns |
| `/todo` | Show the current todo list |

## UI

| Command | Description |
|:---|:---|
| `/theme` | Pick a color theme |
| `/vim` | Toggle vim keybindings in the prompt |
| `/brief` | Toggle brief mode |
| `/keybindings` | Print all keybindings |

## Bridges & Social

| Command | Description |
|:---|:---|
| `/whatsapp` | Set up the WhatsApp bridge |
| `/discord` | Set up the Discord bridge |
| `/setup-reddit` | Connect Reddit for posting |
| `/setup-x` | Connect X (Twitter) for posting |
| `/reddit <text>` | Post to Reddit |
| `/tweet <text>` | Post to X |

## Utility

| Command | Description |
|:---|:---|
| `/clipboard` | Read / write the system clipboard |
| `/image` | Insert an image into the conversation |
| `/time` | Print current time / convert timezones |
| `/calc <expr>` | Calculator |
| `/json` | Format / validate JSON |
| `/encode`, `/decode` | base64, url, hex |
| `/uuid` | Generate UUIDs |
| `/hash <algo>` | Hash a string or file |
| `/regex` | Test a regex against sample input |
| `/sql` | Format SQL |
| `/diagram` | Render a Mermaid diagram |
| `/translate` | Translate text |
| `/ip`, `/port`, `/processes`, `/disk` | Quick system info |
| `/open <path>` | Open a file in your editor |
| `/weather` | Show weather (uses location) |
