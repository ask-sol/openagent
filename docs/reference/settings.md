---
title: Settings
parent: Reference
nav_order: 3
---

# Settings

OpenAgent stores its config in `~/.openagent/config.json`. You can edit it manually, but most things have a slash command equivalent (`/provider`, `/model`, `/response-mode`, etc.).

## Schema

```json
{
  "provider": "anthropic-max",
  "model": "claude-opus-4-7",
  "apiKey": "...",
  "baseUrl": null,
  "responseMode": "concise",
  "setupComplete": true,
  "thinking": false,
  "maxTokens": null,
  "reddit": {
    "clientId": "...",
    "clientSecret": "...",
    "refreshToken": "...",
    "username": "..."
  },
  "x": {
    "apiKey": "...",
    "apiSecret": "...",
    "accessToken": "...",
    "accessSecret": "..."
  }
}
```

## Files in `~/.openagent/`

| File | Purpose |
|:---|:---|
| `config.json` | Main settings (above) |
| `permissions.json` | Permission rules and mode |
| `mcp_servers.json` | Installed MCP servers |
| `plugins.json` | Enabled plugins |
| `sessions/` | Per-directory session history (JSONL) |
| `snapshots/` | Snapshot rollback points (from the snapshot plugin) |
| `last-update-check.json` | Cached version check |
| `.claude-oauth.json` | Claude Max OAuth tokens (when using subscription auth) |

## Environment variable overrides

Most settings can be overridden per-launch:

| Env var | Effect |
|:---|:---|
| `OPENAGENT_PROVIDER` | Force a provider |
| `OPENAGENT_MODEL` | Force a model |
| `OPENAGENT_API_KEY` | Override the saved API key |
| `OLLAMA_HOST` | Custom Ollama host |
| `LMSTUDIO_HOST` | Custom LM Studio host |
| `MLX_HOST` | Custom MLX host |
