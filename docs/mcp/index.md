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

Edit `~/.openagent/mcp_servers.json` directly to add servers not in the catalog. Format follows the MCP standard:

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

Then run `/mcp-status` to confirm it's connected and showing tools.

## Removing a server

Open the store with `/mcp`, select the server (it'll have a `✓` next to it), and choose **Remove from config**.

## Roadmap

- Server health and per-tool toggles directly from the store
- Auto-update server packages
- Verified-publisher catalog (signed manifests)
