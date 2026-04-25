---
title: MCP
nav_order: 5
---

# MCP — Model Context Protocol

[MCP](https://modelcontextprotocol.io) is an open standard for connecting AI agents to external tools and data sources. OpenAgent ships with a curated MCP store: pick a server, install with one click, restart, done.

## Open the store

```
/mcp
```

You'll see the catalog. Press Enter on a server to view details, prompt for any required env vars, and install.

## Curated servers

| ID | Category | What it adds |
|:---|:---|:---|
| `filesystem` | Files | Read, write, search files in a sandboxed directory |
| `git` | VCS | Inspect history, diffs, and branches of a local git repo |
| `github` | VCS | Search code, issues, PRs across GitHub via API (needs `GITHUB_PAT`) |
| `postgres` | Data | Read-only Postgres queries (needs connection string) |
| `sqlite` | Data | Query a local SQLite database file |
| `puppeteer` | Browser | Browse and screenshot live websites with a headless browser |
| `fetch` | Browser | Fetch arbitrary URLs and convert to markdown |
| `brave-search` | Search | Web and local search via Brave (needs `BRAVE_API_KEY`) |
| `slack` | Comms | Read and post in Slack workspaces (needs bot token) |
| `memory` | Memory | Persistent knowledge graph the agent reads and writes across sessions |

## How it works

When you install a server, OpenAgent writes its config to `~/.openagent/mcp_servers.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..." }
    }
  }
}
```

On the next OpenAgent launch, it spawns each configured server, fetches its tool list, and exposes those tools to the agent under `mcp_<server>_<tool>`.

## Adding a custom server

You have two options.

### Option 1 — through the UI (recommended)

Run `/mcp` and pick **Custom**. You'll be walked through four steps:

1. **ID** — short name for the server (e.g. `my-postgres`).
2. **Command** — the executable: `npx`, `uvx`, `node`, `python3`, or an absolute path.
3. **Arguments** — space-separated args, e.g. `-y @scope/server-name /path/to/data`.
4. **Environment** — `KEY=VALUE` pairs, comma-separated. Empty = none.

OpenAgent writes the entry to `~/.openagent/mcp_servers.json` and prompts you to restart to load it.

### Option 2 — edit the config file directly

```
~/.openagent/mcp_servers.json
```

That's the single source of truth. Format follows the MCP standard:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": { "MY_ENV": "value" }
    }
  }
}
```

After editing, restart OpenAgent. Run `/mcp` → **Installed** to confirm it's loaded (`●` next to the name = live).

## Where everything lives

| File | Purpose |
|:---|:---|
| `~/.openagent/mcp_servers.json` | All MCP server configs (catalog installs + your customs) |
| `/mcp` → Store | Browse and install curated servers |
| `/mcp` → Installed | See connection status, remove servers |
| `/mcp` → Custom | Add a server not in the catalog |
| `/mcp-status` | One-line summary of which servers are live |

## Submitting an MCP to the OpenAgent catalog

Built an MCP server you think should be in the curated catalog? Open a PR.

1. Fork [`ask-sol/openagent`](https://github.com/ask-sol/openagent).
2. Add an entry to `src/mcp/catalog.ts` with the same shape as the existing ones (id, name, description, category, command, args, optional env vars and notes).
3. Update this docs page with your server in the table above.
4. Open a PR titled `mcp: add <your-server-name>`.

Maintainers review for: working command, sensible defaults, clear env var descriptions, and that the underlying server is actually published (npm / pypi / GitHub). Anything weird, unmaintained, or proprietary-paywalled gets bounced.

## Removing a server

Open the store with `/mcp`, select the server (it'll have a `✓` next to it), and choose **Remove from config**.

## Roadmap

- Server health and per-tool toggles directly from the store
- Auto-update server packages
- Verified-publisher catalog (signed manifests)
