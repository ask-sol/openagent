---
title: Permission modes
parent: Essentials
nav_order: 3
---

# Permission modes

OpenAgent never silently runs commands or writes files without your knowledge. Three modes control how aggressively it asks.

| Mode | When it asks | Best for |
|:---|:---|:---|
| **Standard** *(default)* | Before any file write or shell command | Daily use on real projects |
| **Cautious** | Before *every* tool call (file reads, searches, everything) | Untrusted code, security-sensitive work |
| **Unrestricted** | Never asks (UI turns red) | Sandboxed VMs, throwaway directories |

## Cycling modes

Press **Shift+Tab** to cycle through modes mid-session. The status bar at the bottom shows the active mode.

## Setting a mode at launch

```bash
openagent -c    # cautious
openagent -u    # unrestricted (asks once per directory before enabling)
```

## Per-tool rules

You can tell OpenAgent to always allow or always block a specific tool. From any prompt:

```
/permissions
```

opens an editor where you can add rules like *"always allow Bash for `git status`"* or *"always deny FileWrite to `~/.ssh`"*.

## Unrestricted mode safety

The first time you launch with `-u` in a directory, OpenAgent prompts:

```
⚠️  Unrestricted mode disables ALL permission prompts.
   The AI can execute any command, modify any file, and make network requests without asking.

   Enable unrestricted mode for this directory? (yes/no):
```

This consent is stored per-directory in `~/.openagent/permissions.json`. To revoke, delete that file or run `/permissions` and remove the rule.

> **Warning** Unrestricted mode is genuinely unrestricted. The agent can `rm -rf`, exfiltrate keys, or hit production endpoints. Use it in sandboxes, not on your real machine.
{: .warning }
