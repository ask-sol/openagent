---
title: Plugins
nav_order: 4
---

# Plugins

OpenAgent ships with bundled plugins that add specialised tools to the agent. Toggle them on and off in the plugin store.

## Open the store

```
/plugins
```

You'll see every bundled plugin with its category, an enabled/disabled dot, and a one-line description. Press Enter on one to view details and toggle it.

## Bundled plugins

| ID | Adds tools | What it does |
|:---|:---|:---|
| `lint-runner` | `Lint` | Auto-detects and runs eslint, biome, ruff, clippy, or `go vet`. Returns findings inline. |
| `test-runner` | `Test` | Auto-detects and runs vitest, jest, pytest, `cargo test`, or `go test`. |
| `stack-trace` | `ResolveStackTrace` | Maps each frame in a stack trace back to source code with ±3 lines of context. |
| `dep-audit` | `DepAudit` | Runs `npm audit` / `pip-audit` / `cargo audit`, surfaces vulnerabilities by severity. |
| `git-blame` | `GitBlame` | Returns blame for a line range *plus* the commit messages of the relevant commits — answers "why does this look this way?" |
| `snapshot` | `SnapshotCreate`, `SnapshotList`, `SnapshotRestore` | Creates rollback points before risky edits; restores from any of them. |
| `env-check` | `EnvCheck` | Cross-references `process.env` / `os.environ` usage against `.env` files. Catches missing config. |

## How they work

Each plugin is just a `Tool` (or set of tools) the agent can call. When you enable a plugin, its tools join the global tool registry on the next OpenAgent restart. The agent decides when to call them based on the user request.

## Storage

Enabled plugins are saved to `~/.openagent/plugins.json`:

```json
{
  "enabled": ["lint-runner", "test-runner", "snapshot"]
}
```

You can edit this directly if you want.

## Writing your own plugin

Plugins live in `src/plugins/builtin/<name>.ts` and export a `Plugin` object:

```ts
import type { Plugin } from "../index.js";
import type { Tool } from "../../tools/types.js";

const myTool: Tool = {
  name: "MyTool",
  description: "What it does. Concise, agent-readable.",
  parameters: {
    type: "object",
    properties: { /* JSON schema */ },
  },
  async execute(input, ctx) {
    return { output: "result text" };
  },
};

export const myPlugin: Plugin = {
  id: "my-plugin",
  name: "My Plugin",
  description: "One-liner shown in /plugins",
  category: "code-quality",
  tools: [myTool],
};
```

Then add it to `BUILTIN_PLUGINS` in `src/plugins/index.ts`.

## Submitting a plugin to OpenAgent

Want your plugin in the bundled set? Open a PR.

1. Fork [`ask-sol/openagent`](https://github.com/ask-sol/openagent).
2. Add `src/plugins/builtin/<your-plugin>.ts` exporting a `Plugin` object.
3. Register it in `BUILTIN_PLUGINS` (`src/plugins/index.ts`).
4. Add a row to the table above with name, tools, and what it does.
5. Open a PR titled `plugin: add <your-plugin>`.

Maintainers review for: tool names that don't clash with existing ones, descriptions that an agent can actually parse, sensible defaults, and that any external commands you call (`npm`, `git`, `cargo`, etc.) actually exist on the user's machine before running. Plugins that hit the network without explicit user input or that read files outside the working directory get bounced.

A proper external plugin loader (npm-published `openagent-plugin-*` packages, auto-discovered) is on the roadmap.
