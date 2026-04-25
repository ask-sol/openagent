---
title: Install
parent: Essentials
nav_order: 2
---

# Install
{: .no_toc }

1. TOC
{:toc}

## macOS

```bash
brew install ask-sol/openagent/openagent
```

This adds the `ask-sol/openagent` Homebrew tap and installs the latest release. Updates happen via `brew upgrade openagent` or `openagent --upgrade` (which shows a live progress bar).

## Linux / WSL

```bash
curl -fsSL https://raw.githubusercontent.com/ask-sol/openagent/main/scripts/install-remote.sh | bash
```

The script installs OpenAgent to `~/.openagent/app` and symlinks `openagent` into your PATH.

## From source

Use this if you want to hack on OpenAgent itself.

```bash
git clone https://github.com/ask-sol/openagent.git
cd openagent
bash scripts/install-user.sh
```

This builds with [Bun](https://bun.sh) and installs the resulting binary locally.

## Updating

```bash
openagent --upgrade
```

Refreshes the Homebrew tap and reinstalls. Falls back to a git-pull update if Homebrew isn't available.

## Uninstall

```bash
brew uninstall openagent
brew untap ask-sol/openagent
rm -rf ~/.openagent
```

## Requirements

- **Node.js 20+** (auto-installed by Homebrew on macOS; on Linux install via your package manager or the install script).
- **A terminal that supports 256 colors and Unicode** — modern macOS Terminal, iTerm2, Warp, Ghostty, GNOME Terminal, Windows Terminal all work.
- **Optional but recommended:** [Ollama](https://ollama.com), [LM Studio](https://lmstudio.ai), or [MLX](https://github.com/ml-explore/mlx-lm) if you plan to run models locally.

## Verify

```bash
openagent --version
```

Should print the current version, e.g. `0.1.33-20260419`.
