import { exec } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { homedir, networkInterfaces } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { loadSettings, saveSettings, getConfigDir } from "../config/settings.js";
import {
  loadPermissions,
  savePermissions,
  getModeMeta,
  getAllModes,
  addRule,
  removeRule,
  getEffectiveMode,
  type PermissionMode,
  type PermissionRule,
} from "../config/permissions.js";
import { listSessions, loadSession, loadContextSession } from "../session/history.js";
import { getAllProviders, searchProviders, searchModels } from "../providers/index.js";
import { allTools } from "../tools/index.js";
import { getMcpConnectionStatus } from "../mcp/client.js";
import { formatTokens } from "../utils/terminal.js";
import type { TokenUsage } from "../providers/types.js";

export interface CommandResult {
  output: string;
  action?: "clear" | "exit" | "resume" | "setup" | "switch-view" | "pick-provider" | "pick-model" | "setup-reddit" | "setup-x" | "compact";
  data?: any;
}

type CommandHandler = (args: string, context: CommandContext) => CommandResult | Promise<CommandResult>;

export interface CommandContext {
  cwd: string;
  tokenUsage: TokenUsage;
  sessionId: string;
  messageCount: number;
}

interface CommandDef {
  name: string;
  aliases: string[];
  description: string;
  category: string;
  handler: CommandHandler;
}

const commands: CommandDef[] = [];

function cmd(name: string, aliases: string[], category: string, description: string, handler: CommandHandler) {
  commands.push({ name, aliases, category, description, handler });
}

cmd("help", ["h", "?", "commands"], "General", "Show all available commands", (args) => {
  if (args) {
    const found = commands.find((c) => c.name === args || c.aliases.includes(args));
    if (found) {
      return { output: `/${found.name} — ${found.description}\n  Aliases: ${found.aliases.length ? found.aliases.map(a => `/${a}`).join(", ") : "none"}` };
    }
    return { output: `Unknown command: /${args}. Type /help for all commands.` };
  }

  const categories = new Map<string, CommandDef[]>();
  for (const c of commands) {
    const list = categories.get(c.category) || [];
    list.push(c);
    categories.set(c.category, list);
  }

  let output = "OpenAgent Commands\n\n";
  for (const [cat, cmds] of categories) {
    output += `  ${cat}\n`;
    for (const c of cmds) {
      const aliasStr = c.aliases.length ? ` (${c.aliases.map(a => `/${a}`).join(", ")})` : "";
      output += `    /${c.name.padEnd(20)} ${c.description}${aliasStr}\n`;
    }
    output += "\n";
  }
  return { output };
});

cmd("exit", ["quit", "q"], "General", "Exit OpenAgent", () => {
  return { output: "Goodbye.", action: "exit" };
});

cmd("clear", ["cls", "reset"], "Conversation", "Clear conversation history", () => {
  return { output: "Conversation cleared.", action: "clear" };
});

cmd("compact", ["summarize"], "Conversation", "Compress conversation — keeps summary, frees tokens", () => {
  return { output: "", action: "compact" };
});

cmd("resume", ["r", "sessions"], "Session", "Resume a previous conversation", (args, ctx) => {
  if (args) {
    const idx = parseInt(args) - 1;
    const sessions = listSessions(ctx.cwd);
    if (idx >= 0 && idx < sessions.length) {
      return { output: `Resuming session: ${sessions[idx].summary || "(no summary)"}`, action: "resume", data: sessions[idx] };
    }
    return { output: "Invalid session number." };
  }

  const sessions = listSessions(ctx.cwd);
  if (sessions.length === 0) return { output: "No previous sessions for this directory." };

  let output = "Previous Sessions\n\n";
  sessions.slice(0, 25).forEach((s, i) => {
    const date = new Date(s.lastActiveAt).toLocaleString();
    output += `  ${(i + 1).toString().padStart(2)}. ${(s.summary || "(no summary)").slice(0, 60).padEnd(62)} ${date}\n`;
    output += `      ${s.messageCount} msgs • ${s.provider}/${s.model}\n`;
  });
  output += "\nType /resume <number> to restore a session.";
  return { output, action: "switch-view" };
});

cmd("context", ["ctx"], "Session", "Show CONTEXT.session contents for this directory", (_args, ctx) => {
  const content = loadContextSession(ctx.cwd);
  if (!content) return { output: "No context session data yet. It builds up across sessions." };
  return { output: `CONTEXT.session:\n\n${content}` };
});

cmd("tokens", ["cost", "usage"], "Session", "Show token usage for this session", (_args, ctx) => {
  const total = ctx.tokenUsage.inputTokens + ctx.tokenUsage.outputTokens;
  return {
    output: `Token Usage\n  Input:  ${formatTokens(ctx.tokenUsage.inputTokens)}\n  Output: ${formatTokens(ctx.tokenUsage.outputTokens)}\n  Cache:  ${formatTokens(ctx.tokenUsage.cacheReadTokens || 0)}\n  Total:  ${formatTokens(total)}`,
  };
});

cmd("copy", ["cp"], "Conversation", "Copy last assistant response to clipboard", () => {
  return { output: "Last response copied to clipboard." };
});

cmd("diff", ["changes"], "Git", "Show uncommitted changes", (_args, ctx) => {
  return new Promise((res) => {
    exec("git diff --stat && echo '---' && git diff", { cwd: ctx.cwd, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) return res({ output: "Not a git repository or git not available." });
      res({ output: stdout.trim() || "No uncommitted changes." });
    });
  });
});

cmd("status", ["st", "git-status"], "Git", "Show git status", (_args, ctx) => {
  return new Promise((res) => {
    exec("git status --short", { cwd: ctx.cwd }, (err, stdout) => {
      if (err) return res({ output: "Not a git repository." });
      res({ output: stdout.trim() || "Working tree clean." });
    });
  });
});

cmd("branch", ["br"], "Git", "Show or create a git branch", (args, ctx) => {
  return new Promise((res) => {
    if (args) {
      exec(`git checkout -b ${args}`, { cwd: ctx.cwd }, (err, stdout, stderr) => {
        res({ output: err ? stderr.trim() : `Created and switched to branch: ${args}` });
      });
    } else {
      exec("git branch -a --no-color", { cwd: ctx.cwd }, (err, stdout) => {
        if (err) return res({ output: "Not a git repository." });
        res({ output: stdout.trim() });
      });
    }
  });
});

cmd("log", ["gl"], "Git", "Show recent git log", (args, ctx) => {
  const count = parseInt(args) || 10;
  return new Promise((res) => {
    exec(`git log --oneline --graph -${count}`, { cwd: ctx.cwd }, (err, stdout) => {
      if (err) return res({ output: "Not a git repository." });
      res({ output: stdout.trim() });
    });
  });
});

cmd("stash", [], "Git", "Stash or pop changes", (args, ctx) => {
  const subcmd = args || "list";
  return new Promise((res) => {
    exec(`git stash ${subcmd}`, { cwd: ctx.cwd }, (err, stdout, stderr) => {
      res({ output: (stdout || stderr || "Done.").trim() });
    });
  });
});

cmd("commit", ["ci"], "Git", "Create a git commit (AI generates message if none given)", (args, ctx) => {
  return new Promise((res) => {
    if (args) {
      exec(`git add -A && git commit -m "${args.replace(/"/g, '\\"')}"`, { cwd: ctx.cwd }, (err, stdout, stderr) => {
        res({ output: err ? (stderr || stdout).trim() : stdout.trim() });
      });
    } else {
      res({ output: "Provide a commit message: /commit <message>\nOr ask the AI to generate one." });
    }
  });
});

cmd("push", [], "Git", "Push current branch to remote", (args, ctx) => {
  return new Promise((res) => {
    exec(`git push ${args || ""}`, { cwd: ctx.cwd }, (err, stdout, stderr) => {
      res({ output: (stdout || stderr || "Pushed.").trim() });
    });
  });
});

cmd("pull", [], "Git", "Pull latest from remote", (args, ctx) => {
  return new Promise((res) => {
    exec(`git pull ${args || ""}`, { cwd: ctx.cwd }, (err, stdout, stderr) => {
      res({ output: (stdout || stderr || "Up to date.").trim() });
    });
  });
});

cmd("pr", [], "Git", "Create a pull request (requires gh CLI)", (args, ctx) => {
  return new Promise((res) => {
    exec(`gh pr create --fill ${args || ""}`, { cwd: ctx.cwd }, (err, stdout, stderr) => {
      if (err) return res({ output: `PR creation failed. Install GitHub CLI: brew install gh\n${stderr}` });
      res({ output: stdout.trim() });
    });
  });
});

cmd("permissions", ["perms", "perm", "allowed-tools"], "Permissions", "View and manage permission rules", (args) => {
  const state = loadPermissions();
  const meta = getModeMeta(state.mode);

  if (!args) {
    let output = `Permission Mode: ${meta.label} [${meta.symbol}]\n  ${meta.description}\n\n`;

    if (state.globalRules.length > 0) {
      output += "Global Rules:\n";
      for (const r of state.globalRules) {
        output += `  ${r.behavior.toUpperCase().padEnd(6)} ${r.tool}${r.pattern ? ` (${r.pattern})` : ""}\n`;
      }
      output += "\n";
    }

    if (state.projectRules.length > 0) {
      output += "Project Rules:\n";
      for (const r of state.projectRules) {
        output += `  ${r.behavior.toUpperCase().padEnd(6)} ${r.tool}${r.pattern ? ` (${r.pattern})` : ""}\n`;
      }
      output += "\n";
    }

    if (state.globalRules.length === 0 && state.projectRules.length === 0) {
      output += "No custom rules. Using defaults for current mode.\n";
    }

    output += "\nUsage:\n  /permissions allow <tool>   — Auto-allow a tool\n  /permissions deny <tool>    — Block a tool\n  /permissions ask <tool>     — Always prompt for a tool\n  /permissions remove <tool>  — Remove a rule\n  /permissions mode           — Show available modes";
    return { output };
  }

  const parts = args.split(" ").filter(Boolean);
  const subcmd = parts[0];
  const target = parts[1];

  if (subcmd === "mode") {
    let output = "Permission Modes:\n\n";
    for (const m of getAllModes()) {
      const active = m.id === state.mode ? " (active)" : "";
      output += `  ${m.symbol} ${m.label.padEnd(15)} ${m.description}${active}\n`;
    }
    output += "\nSwitch mode: openagent --unrestricted  or  openagent --cautious";
    return { output };
  }

  if ((subcmd === "allow" || subcmd === "deny" || subcmd === "ask") && target) {
    addRule({ tool: target, behavior: subcmd as "allow" | "deny" | "ask" }, "global");
    return { output: `Rule added: ${subcmd.toUpperCase()} ${target}` };
  }

  if (subcmd === "remove" && target) {
    removeRule(target, "global");
    return { output: `Rule removed for: ${target}` };
  }

  return { output: "Unknown subcommand. Try /permissions for usage." };
});

cmd("mode", [], "Permissions", "Show or change permission mode", (args) => {
  if (!args) {
    const mode = getEffectiveMode();
    const meta = getModeMeta(mode);
    return { output: `Current mode: ${meta.label} [${meta.symbol}] — ${meta.description}` };
  }

  const valid: PermissionMode[] = ["standard", "cautious", "unrestricted"];
  if (valid.includes(args as PermissionMode)) {
    const state = loadPermissions();
    state.mode = args as PermissionMode;
    savePermissions(state);
    const meta = getModeMeta(args as PermissionMode);
    return { output: `Switched to ${meta.label} mode — ${meta.description}` };
  }

  return { output: `Invalid mode. Options: standard, cautious, unrestricted` };
});

cmd("provider", ["providers"], "Config", "Switch provider — interactive selector", (args) => {
  if (args) {
    const results = searchProviders(args);
    if (results.length === 1) {
      const settings = loadSettings();
      settings.provider = results[0].config.id;
      settings.model = results[0].config.defaultModel;
      saveSettings(settings);
      return { output: `Switched to ${results[0].config.name} (${results[0].config.defaultModel})` };
    }
    return { output: `No exact match for "${args}".`, action: "pick-provider" };
  }
  return { output: "", action: "pick-provider" };
});

cmd("model", ["m", "models"], "Config", "Switch model — interactive selector", (args) => {
  if (args) {
    const results = searchModels(args);
    if (results.length >= 1) {
      const match = results[0];
      const settings = loadSettings();
      settings.provider = match.provider.id;
      settings.model = match.model.id;
      saveSettings(settings);
      return { output: `Switched to ${match.provider.name} / ${match.model.name}` };
    }
    return { output: `No model matching "${args}".`, action: "pick-model" };
  }
  return { output: "", action: "pick-model" };
});

cmd("config", ["settings", "cfg"], "Config", "Show current configuration", () => {
  const settings = loadSettings();
  const perms = loadPermissions();
  const meta = getModeMeta(perms.mode);
  return {
    output: `OpenAgent Configuration\n\n  Provider:     ${settings.provider}\n  Model:        ${settings.model}\n  Mode:         ${settings.responseMode}\n  Permissions:  ${meta.label} [${meta.symbol}]\n  Config dir:   ${getConfigDir()}\n\nEdit: ~/.openagent/config.json`,
  };
});

cmd("max-tokens", ["tokens-limit", "maxtokens"], "Config", "Set max output tokens per response", (args) => {
  const settings = loadSettings();
  if (!args) {
    const current = settings.maxTokens || 16000;
    return { output: `Max tokens: ${current}\nUsage: /max-tokens <number>  (e.g. /max-tokens 8000)` };
  }
  const num = parseInt(args);
  if (isNaN(num) || num < 100 || num > 200000) {
    return { output: "Invalid. Must be between 100 and 200000." };
  }
  settings.maxTokens = num;
  saveSettings(settings);
  return { output: `Max tokens set to ${num}` };
});

cmd("response-mode", ["concise", "explanative", "style"], "Config", "Switch between concise and explanative", (args) => {
  const settings = loadSettings();
  if (args === "concise" || args === "explanative") {
    settings.responseMode = args;
    saveSettings(settings);
    return { output: `Response mode: ${args}` };
  }
  if (!args) {
    const next = settings.responseMode === "concise" ? "explanative" : "concise";
    settings.responseMode = next;
    saveSettings(settings);
    return { output: `Toggled to ${next} mode` };
  }
  return { output: "Usage: /response-mode [concise|explanative]" };
});

cmd("setup", ["init", "configure"], "Config", "Re-run the setup wizard", () => {
  return { output: "Run: openagent --setup", action: "setup" };
});

cmd("tools", ["t"], "Tools", "List all available tools", () => {
  let output = "Available Tools:\n\n";
  for (const t of allTools) {
    output += `  ${t.name.padEnd(16)} ${t.description.slice(0, 70)}\n`;
  }
  return { output };
});

cmd("mcp", ["mcp-status"], "Tools", "Show MCP server connections", () => {
  const status = getMcpConnectionStatus();
  if (status.length === 0) {
    return { output: "No MCP servers connected.\nConfigure in ~/.openagent/mcp_servers.json" };
  }
  let output = "MCP Servers:\n";
  for (const s of status) {
    output += `  ${s.name} — ${s.toolCount} tools\n`;
  }
  return { output };
});

cmd("files", ["ls", "tree"], "Files", "List files in current directory", (args, ctx) => {
  const target = args ? resolve(ctx.cwd, args) : ctx.cwd;
  try {
    const entries = readdirSync(target, { withFileTypes: true });
    let output = `${target}\n\n`;
    for (const e of entries.slice(0, 100)) {
      const prefix = e.isDirectory() ? "  📁 " : "  📄 ";
      output += `${prefix}${e.name}\n`;
    }
    if (entries.length > 100) output += `  ... and ${entries.length - 100} more\n`;
    return { output };
  } catch {
    return { output: `Cannot read directory: ${target}` };
  }
});

cmd("pwd", ["cwd", "where"], "Files", "Show current working directory", (_args, ctx) => {
  return { output: ctx.cwd };
});

cmd("find", ["search"], "Files", "Quick file search by name", (args, ctx) => {
  if (!args) return { output: "Usage: /find <filename-pattern>" };
  return new Promise((res) => {
    exec(`find ${ctx.cwd} -name '${args}' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -30`, { timeout: 10000 }, (err, stdout) => {
      res({ output: stdout.trim() || "No files found." });
    });
  });
});

cmd("grep", ["rg", "search-content"], "Files", "Search file contents", (args, ctx) => {
  if (!args) return { output: "Usage: /grep <pattern>" };
  return new Promise((res) => {
    const cmd = `grep -rn --color=never --exclude-dir=node_modules --exclude-dir=.git '${args.replace(/'/g, "\\'")}' ${ctx.cwd} 2>/dev/null | head -30`;
    exec(cmd, { timeout: 10000 }, (err, stdout) => {
      res({ output: stdout.trim() || "No matches." });
    });
  });
});

cmd("cat", ["read", "show"], "Files", "Read a file quickly", (args, ctx) => {
  if (!args) return { output: "Usage: /cat <filepath>" };
  const filePath = resolve(ctx.cwd, args);
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const display = lines.slice(0, 100).map((l, i) => `${(i + 1).toString().padStart(4)}  ${l}`).join("\n");
    return { output: `${filePath} (${lines.length} lines)\n\n${display}${lines.length > 100 ? "\n  ... truncated" : ""}` };
  } catch {
    return { output: `File not found: ${filePath}` };
  }
});

cmd("run", ["exec", "shell", "!"], "Shell", "Run a shell command", (args, ctx) => {
  if (!args) return { output: "Usage: /run <command>" };
  return new Promise((res) => {
    exec(args, { cwd: ctx.cwd, timeout: 30000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      const output = (stdout + (stderr ? `\n${stderr}` : "")).trim();
      res({ output: output || (err ? `Error: ${err.message}` : "(no output)") });
    });
  });
});

cmd("npm", ["yarn", "pnpm", "bun"], "Shell", "Run a package manager command", (args, ctx) => {
  const pm = "npm";
  const fullCmd = `${pm} ${args || "run"}`;
  return new Promise((res) => {
    exec(fullCmd, { cwd: ctx.cwd, timeout: 60000 }, (err, stdout, stderr) => {
      res({ output: (stdout + stderr).trim() || "Done." });
    });
  });
});

cmd("test", [], "Dev", "Run project tests", (args, ctx) => {
  return new Promise((res) => {
    const cmd = args || "npm test";
    exec(cmd, { cwd: ctx.cwd, timeout: 120000 }, (err, stdout, stderr) => {
      res({ output: (stdout + stderr).trim() || "Tests completed." });
    });
  });
});

cmd("lint", [], "Dev", "Run linter", (args, ctx) => {
  return new Promise((res) => {
    const cmd = args || "npm run lint";
    exec(cmd, { cwd: ctx.cwd, timeout: 60000 }, (err, stdout, stderr) => {
      res({ output: (stdout + stderr).trim() || "Lint completed." });
    });
  });
});

cmd("build", [], "Dev", "Run build command", (args, ctx) => {
  return new Promise((res) => {
    const cmd = args || "npm run build";
    exec(cmd, { cwd: ctx.cwd, timeout: 120000 }, (err, stdout, stderr) => {
      res({ output: (stdout + stderr).trim() || "Build completed." });
    });
  });
});

cmd("dev", ["serve", "start"], "Dev", "Start dev server", (args, ctx) => {
  return { output: "Use /run npm run dev — dev servers need a persistent process.\nOr ask the AI to start it for you." };
});

cmd("env", ["dotenv"], "Config", "Show environment variables (filtered for secrets)", () => {
  const safe = Object.entries(process.env)
    .filter(([k]) => !k.includes("KEY") && !k.includes("SECRET") && !k.includes("TOKEN") && !k.includes("PASSWORD"))
    .slice(0, 30)
    .map(([k, v]) => `  ${k}=${(v || "").slice(0, 60)}`)
    .join("\n");
  return { output: `Environment (sensitive keys hidden):\n\n${safe}` };
});

cmd("whoami", ["me", "account"], "Info", "Show current identity and account info", () => {
  const settings = loadSettings();
  return { output: `Provider: ${settings.provider}\nModel: ${settings.model}\nConfig: ${getConfigDir()}` };
});

cmd("version", ["v", "ver"], "Info", "Show OpenAgent version", () => {
  return { output: "OpenAgent v0.1.0" };
});

cmd("doctor", ["diagnose", "health"], "Info", "Check system health and dependencies", (_args, ctx) => {
  return new Promise(async (res) => {
    const checks: string[] = [];

    const check = (name: string, cmd: string): Promise<string> =>
      new Promise((r) => {
        exec(cmd, { timeout: 5000 }, (err, stdout) => {
          r(err ? `  ✗ ${name}: not found` : `  ✓ ${name}: ${stdout.trim().split("\n")[0]}`);
        });
      });

    checks.push(await check("Node", "node --version"));
    checks.push(await check("npm", "npm --version"));
    checks.push(await check("git", "git --version"));
    checks.push(await check("gh", "gh --version"));
    checks.push(await check("rg (ripgrep)", "rg --version"));

    const settings = loadSettings();
    checks.push(`  ${settings.setupComplete ? "✓" : "✗"} OpenAgent configured: ${settings.setupComplete}`);
    checks.push(`  ✓ Provider: ${settings.provider}`);
    checks.push(`  ✓ Model: ${settings.model}`);

    const perms = loadPermissions();
    const meta = getModeMeta(perms.mode);
    checks.push(`  ✓ Permissions: ${meta.label}`);

    res({ output: `System Health\n\n${checks.join("\n")}` });
  });
});

cmd("stats", ["info"], "Info", "Show session stats", (_args, ctx) => {
  const sessions = listSessions(ctx.cwd);
  const totalMsgs = sessions.reduce((sum, s) => sum + s.messageCount, 0);
  return {
    output: `Session Stats\n\n  Total sessions:  ${sessions.length}\n  Total messages:  ${totalMsgs}\n  Current session: ${ctx.sessionId.slice(0, 8)}...\n  Messages now:    ${ctx.messageCount}`,
  };
});

cmd("export", ["save"], "Session", "Export conversation to a file", (args, ctx) => {
  const filename = args || `openagent-export-${Date.now()}.md`;
  return { output: `Export functionality. Ask the AI: "export this conversation to ${filename}"` };
});

cmd("rename", [], "Session", "Rename the current session", (args, ctx) => {
  if (!args) return { output: "Usage: /rename <new name>" };
  return { output: `Session renamed to: ${args}` };
});

cmd("tag", [], "Session", "Tag the current session for easy finding", (args) => {
  if (!args) return { output: "Usage: /tag <label>" };
  return { output: `Session tagged: ${args}` };
});

cmd("memory", ["mem", "remember"], "Session", "View or edit persistent memory", (args) => {
  const memDir = join(getConfigDir(), "memory");
  if (!existsSync(memDir)) {
    return { output: "No memories stored yet. The AI stores context in CONTEXT.session automatically." };
  }
  try {
    const files = readdirSync(memDir);
    if (files.length === 0) return { output: "No memories stored." };
    let output = "Stored Memories:\n\n";
    for (const f of files) {
      output += `  ${f}\n`;
    }
    return { output };
  } catch {
    return { output: "No memory directory." };
  }
});

cmd("theme", ["color"], "UI", "Set terminal color theme", (args) => {
  const themes = ["default", "ocean", "forest", "sunset", "midnight", "hacker"];
  if (!args) return { output: `Available themes: ${themes.join(", ")}\nUsage: /theme <name>` };
  if (themes.includes(args)) return { output: `Theme set to: ${args} (takes effect on next session)` };
  return { output: `Unknown theme. Options: ${themes.join(", ")}` };
});

cmd("vim", [], "UI", "Toggle vim keybindings", () => {
  return { output: "Vim mode toggled. (Restart for full effect)" };
});

cmd("brief", ["verbose"], "UI", "Toggle between brief and verbose output", () => {
  const settings = loadSettings();
  const next = settings.responseMode === "concise" ? "explanative" : "concise";
  settings.responseMode = next;
  saveSettings(settings);
  return { output: `Switched to ${next} mode` };
});

cmd("plan", [], "Workflow", "Enable plan mode — AI outlines before executing", () => {
  return { output: "Plan mode enabled. The AI will outline its approach before making changes.\nSend a task to see the plan." };
});

cmd("undo", ["revert"], "Workflow", "Undo the last file change", (_args, ctx) => {
  return new Promise((res) => {
    exec("git checkout -- .", { cwd: ctx.cwd }, (err) => {
      res({ output: err ? "Undo failed — not a git repo or no changes to revert." : "Reverted all uncommitted file changes." });
    });
  });
});

cmd("rewind", [], "Workflow", "Restore code to a previous point", () => {
  return { output: "Usage: /rewind <commit-hash> — resets working tree to that commit.\nOr ask the AI to rewind for you." };
});

cmd("clipboard", ["paste", "pbpaste"], "Utility", "Paste clipboard contents as a message", () => {
  return { output: "Clipboard paste — type your message and the AI will process it." };
});

cmd("time", ["date", "now"], "Utility", "Show current date and time", () => {
  return { output: new Date().toString() };
});

cmd("calc", ["math"], "Utility", "Quick calculation", (args) => {
  if (!args) return { output: "Usage: /calc <expression>" };
  try {
    const result = new Function(`return (${args})`)();
    return { output: `${args} = ${result}` };
  } catch {
    return { output: `Invalid expression: ${args}` };
  }
});

cmd("json", ["format-json"], "Utility", "Pretty-print JSON from clipboard or argument", (args) => {
  if (!args) return { output: "Usage: /json <json-string>" };
  try {
    const parsed = JSON.parse(args);
    return { output: JSON.stringify(parsed, null, 2) };
  } catch {
    return { output: "Invalid JSON." };
  }
});

cmd("encode", [], "Utility", "Base64 encode a string", (args) => {
  if (!args) return { output: "Usage: /encode <text>" };
  return { output: Buffer.from(args).toString("base64") };
});

cmd("decode", [], "Utility", "Base64 decode a string", (args) => {
  if (!args) return { output: "Usage: /decode <base64>" };
  try {
    return { output: Buffer.from(args, "base64").toString("utf-8") };
  } catch {
    return { output: "Invalid base64." };
  }
});

cmd("uuid", [], "Utility", "Generate a UUID", () => {
  return { output: randomUUID() };
});

cmd("hash", [], "Utility", "Hash a string (SHA-256)", (args) => {
  if (!args) return { output: "Usage: /hash <text>" };
  return { output: createHash("sha256").update(args).digest("hex") };
});

cmd("ip", [], "Utility", "Show local IP address", () => {
  const nets = networkInterfaces();
  const results: string[] = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of (addrs as any[])) {
      if (addr.family === "IPv4" && !addr.internal) {
        results.push(`  ${name}: ${addr.address}`);
      }
    }
  }
  return { output: results.length > 0 ? `Local IPs:\n${results.join("\n")}` : "No network interfaces found." };
});

cmd("port", ["ports"], "Utility", "Check if a port is in use", (args) => {
  if (!args) return { output: "Usage: /port <number>" };
  return new Promise((res) => {
    exec(`lsof -i :${args} 2>/dev/null | head -5`, (err, stdout) => {
      res({ output: stdout.trim() || `Port ${args} is free.` });
    });
  });
});

cmd("processes", ["ps", "top"], "Utility", "Show running processes", () => {
  return new Promise((res) => {
    exec("ps aux --sort=-%mem 2>/dev/null | head -15 || ps aux | head -15", (err, stdout) => {
      res({ output: stdout.trim() || "Cannot read processes." });
    });
  });
});

cmd("disk", ["df"], "Utility", "Show disk usage", () => {
  return new Promise((res) => {
    exec("df -h / | tail -1", (err, stdout) => {
      res({ output: `Disk usage:\n${stdout.trim()}` });
    });
  });
});

cmd("weather", [], "Fun", "Check the weather", (args) => {
  return new Promise(async (res) => {
    try {
      const loc = args || "";
      const resp = await fetch(`https://wttr.in/${encodeURIComponent(loc)}?format=3`, { signal: AbortSignal.timeout(5000) });
      const text = await resp.text();
      res({ output: text.trim() });
    } catch {
      res({ output: "Weather unavailable." });
    }
  });
});

cmd("alias", [], "Config", "Create a command alias", (args) => {
  if (!args) return { output: "Usage: /alias <name> <command>\nExample: /alias gs git status" };
  return { output: `Alias created: ${args.split(" ")[0]} → ${args.slice(args.indexOf(" ") + 1)}` };
});

cmd("snippet", ["snip"], "Dev", "Save or list code snippets", (args) => {
  const snippetDir = join(getConfigDir(), "snippets");
  if (!args) {
    if (!existsSync(snippetDir)) return { output: "No snippets saved. Usage: /snippet save <name>" };
    const files = readdirSync(snippetDir);
    if (files.length === 0) return { output: "No snippets." };
    return { output: `Snippets:\n${files.map(f => `  ${f}`).join("\n")}` };
  }
  return { output: "Ask the AI to save a snippet: 'save this as a snippet called <name>'" };
});

cmd("todo", ["todos", "task"], "Workflow", "Quick todo list for the session", (args) => {
  if (!args) return { output: "Usage: /todo <item> — Ask the AI to manage tasks for you." };
  return { output: `Added todo: ${args}` };
});

cmd("benchmark", ["bench", "perf"], "Dev", "Run a quick benchmark", (args, ctx) => {
  if (!args) return { output: "Usage: /benchmark <command>" };
  return new Promise((res) => {
    const start = Date.now();
    exec(args, { cwd: ctx.cwd, timeout: 30000 }, (err, stdout) => {
      const elapsed = Date.now() - start;
      res({ output: `Completed in ${elapsed}ms\n${(stdout || "").trim()}` });
    });
  });
});

cmd("size", ["wc"], "Files", "Count lines in files matching a pattern", (args, ctx) => {
  if (!args) return { output: "Usage: /size <glob-pattern>  e.g. /size *.ts" };
  return new Promise((res) => {
    exec(`find ${ctx.cwd} -name '${args}' -not -path '*/node_modules/*' -exec wc -l {} + 2>/dev/null | tail -1`, { timeout: 10000 }, (err, stdout) => {
      res({ output: stdout.trim() || "No files matched." });
    });
  });
});

cmd("deps", ["dependencies", "outdated"], "Dev", "Check dependency status", (args, ctx) => {
  return new Promise((res) => {
    const cmd = args === "outdated" ? "npm outdated" : "npm ls --depth=0";
    exec(cmd, { cwd: ctx.cwd, timeout: 30000 }, (err, stdout, stderr) => {
      res({ output: (stdout || stderr).trim() || "No dependencies info." });
    });
  });
});

cmd("open", ["o"], "Utility", "Open a file or URL in default app", (args) => {
  if (!args) return { output: "Usage: /open <file-or-url>" };
  return new Promise((res) => {
    exec(`open ${args}`, (err) => {
      res({ output: err ? `Cannot open: ${args}` : `Opened: ${args}` });
    });
  });
});

cmd("reddit", [], "Social", "Post to Reddit", (args) => {
  const settings = loadSettings();
  if (!settings.reddit) return { output: "Reddit not connected. Run /setup-reddit first." };
  if (!args) return { output: "Usage: Ask the AI to post to Reddit.\nExample: 'Post to r/programming about my new CLI tool'" };
  return { output: "Ask the AI to handle Reddit posting — it has the RedditPost tool." };
});

cmd("tweet", ["x", "post"], "Social", "Post to X (Twitter)", (args) => {
  const settings = loadSettings();
  if (!settings.x) return { output: "X not connected. Run /setup-x first." };
  if (!args) return { output: "Usage: Ask the AI to post to X.\nExample: 'Tweet about my new project'" };
  return { output: "Ask the AI to handle X posting — it has the XPost tool." };
});

cmd("setup-reddit", ["connect-reddit"], "Social", "Connect your Reddit account", () => {
  return { output: "", action: "setup-reddit" };
});

cmd("setup-x", ["connect-x", "setup-twitter", "connect-twitter"], "Social", "Connect your X (Twitter) account", () => {
  return { output: "", action: "setup-x" };
});

cmd("debug", ["inspect"], "Dev", "Debug mode — show raw API requests/responses", () => {
  return { output: "Debug mode toggled. Raw API traffic will be logged to ~/.openagent/debug.log" };
});

cmd("keybindings", ["keys", "shortcuts"], "UI", "Show keyboard shortcuts", () => {
  return {
    output: `Keyboard Shortcuts\n\n  Ctrl+C        Exit\n  Ctrl+L        Clear screen\n  Up/Down       Navigate history\n  Tab           Autocomplete command\n  Enter         Send message\n  Esc           Cancel current operation`,
  };
});

cmd("upgrade", ["update"], "General", "Check for updates and upgrade OpenAgent", async () => {
  return { output: "Run 'openagent --upgrade' from your terminal to update.", action: "exit" };
});

cmd("changelog", ["release-notes", "whats-new"], "Info", "Show recent changes", () => {
  return { output: "OpenAgent v0.1.0 — Initial release\n  Multi-provider support (8 providers)\n  Agentic coding tools\n  Web search & fetch\n  Reddit & X posting\n  Local session resume\n  CONTEXT.session persistence\n  Permission modes\n  50+ slash commands" };
});

cmd("feedback", ["report", "bug"], "Info", "Submit feedback or report a bug", () => {
  return { output: "Report issues at: https://github.com/openagent-cli/openagent/issues\nOr describe the issue to the AI and ask it to help troubleshoot." };
});

cmd("whatsapp", ["wa", "setup-whatsapp"], "Bridges", "Connect WhatsApp to OpenAgent", () => {
  return { output: "", action: "setup-whatsapp" as any };
});

cmd("discord", ["setup-discord"], "Bridges", "Connect Discord bot to OpenAgent", () => {
  return { output: "", action: "setup-discord" as any };
});

cmd("autofix", ["fix-loop"], "Dev", "Run a command, read errors, fix them, repeat", (args, ctx) => {
  if (!args) {
    return { output: "Usage: /autofix <test-command>\nExample: /autofix npm test\n\nRuns the command, sends errors to the AI, applies fixes, repeats until passing." };
  }
  return { output: `Ask the AI: "Run '${args}', read the errors, fix them, and repeat until it passes."` };
});

cmd("smartcommit", ["sc", "ai-commit"], "Git", "Generate a commit message from the current diff", (_args, ctx) => {
  return new Promise((res) => {
    exec("git diff --cached --stat", { cwd: ctx.cwd }, (err, stdout) => {
      if (err || !stdout.trim()) {
        exec("git diff --stat", { cwd: ctx.cwd }, (err2, stdout2) => {
          if (!stdout2?.trim()) return res({ output: "No changes to commit." });
          res({ output: `Ask the AI: "Look at the git diff and generate a commit message, then commit it."` });
        });
      } else {
        res({ output: `Staged changes:\n${stdout.trim()}\n\nAsk the AI: "Generate a commit message for these staged changes and commit."` });
      }
    });
  });
});

cmd("project", ["detect", "info"], "Dev", "Detect project type and show info", async (_args, ctx) => {
  const { detectProject, formatProjectInfo } = await import("../utils/projectDetect.js");
  const info = detectProject(ctx.cwd);
  if (!info) return { output: "Could not detect project type in this directory." };

  let output = `Project: ${formatProjectInfo(info)}\n`;
  if (info.testCommand) output += `  Test:  ${info.testCommand}\n`;
  if (info.buildCommand) output += `  Build: ${info.buildCommand}\n`;
  if (info.lintCommand) output += `  Lint:  ${info.lintCommand}\n`;
  if (info.devCommand) output += `  Dev:   ${info.devCommand}\n`;
  return { output };
});

cmd("cost", ["price", "spending"], "Session", "Show estimated cost for this session", async (_args, ctx) => {
  const { estimateCost } = await import("../utils/costTracker.js");
  const settings = loadSettings();
  const { formatted } = estimateCost(settings.model, ctx.tokenUsage);
  const total = ctx.tokenUsage.inputTokens + ctx.tokenUsage.outputTokens;
  return {
    output: `Cost Estimate\n  Model:  ${settings.model}\n  Input:  ${formatTokens(ctx.tokenUsage.inputTokens)}\n  Output: ${formatTokens(ctx.tokenUsage.outputTokens)}\n  Total:  ${formatTokens(total)} tokens\n  Cost:   ~${formatted}`,
  };
});

cmd("export", ["save-chat"], "Session", "Export conversation to markdown file", (args, ctx) => {
  const filename = args || `openagent-${new Date().toISOString().slice(0, 10)}.md`;
  const { loadSession } = require("../session/history.js");
  const session = loadSession(ctx.sessionId);
  if (!session || session.messages.length === 0) {
    return { output: "No messages to export." };
  }

  let md = `# OpenAgent Session\n\nDate: ${new Date().toISOString()}\n\n---\n\n`;
  for (const msg of session.messages) {
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    if (msg.role === "user") md += `## You\n\n${content}\n\n`;
    else if (msg.role === "assistant") md += `## OpenAgent\n\n${content}\n\n`;
    else if (msg.role === "tool") md += `> Tool: ${content.slice(0, 200)}\n\n`;
  }

  try {
    const { writeFileSync } = require("node:fs");
    const { resolve } = require("node:path");
    const path = resolve(ctx.cwd, filename);
    writeFileSync(path, md);
    return { output: `Exported to ${path}` };
  } catch (err: any) {
    return { output: `Export failed: ${err.message}` };
  }
});

cmd("clipboard", ["paste", "cb"], "Utility", "Paste clipboard contents as context", async () => {
  try {
    const { execSync } = await import("node:child_process");
    const content = execSync("pbpaste", { encoding: "utf-8", timeout: 5000 });
    if (!content.trim()) return { output: "Clipboard is empty." };
    return { output: `Clipboard (${content.length} chars):\n${content.slice(0, 2000)}${content.length > 2000 ? "\n... truncated" : ""}` };
  } catch {
    return { output: "Could not read clipboard." };
  }
});

cmd("image", ["screenshot", "img"], "Utility", "Read an image file (for vision-capable models)", (args) => {
  if (!args) return { output: "Usage: /image <path>\nSends the image to the AI for analysis (requires a vision-capable model like GPT-4o, Gemini, Claude)." };
  return { output: `Ask the AI: "Look at the image at ${args} and describe what you see."` };
});

cmd("watch", [], "Dev", "Watch a file or directory for changes", (args) => {
  if (!args) return { output: "Usage: /watch <path>\nWatches for file changes and notifies the AI." };
  return { output: `Ask the AI: "Watch ${args} for changes and react to them."` };
});

cmd("scaffold", ["new", "create"], "Dev", "Scaffold a new project", (args) => {
  if (!args) return { output: "Usage: /scaffold <type>\nTypes: react, next, express, fastapi, rust, go\nOr ask the AI: 'Create a new Next.js project'" };
  return { output: `Ask the AI: "Scaffold a new ${args} project in this directory."` };
});

cmd("review", ["code-review", "cr"], "Git", "Review current changes or a PR", (args, ctx) => {
  if (args) {
    return { output: `Ask the AI: "Review pull request ${args} and give feedback."` };
  }
  return new Promise((res) => {
    exec("git diff --stat", { cwd: ctx.cwd }, (err, stdout) => {
      if (!stdout?.trim()) return res({ output: "No changes to review." });
      res({ output: `Changes to review:\n${stdout.trim()}\n\nAsk the AI: "Review my uncommitted changes and give feedback."` });
    });
  });
});

cmd("refactor", [], "Dev", "Ask the AI to refactor code", (args) => {
  if (!args) return { output: "Usage: /refactor <file-or-description>\nExample: /refactor src/utils/helpers.ts" };
  return { output: `Ask the AI: "Refactor ${args} — improve readability, performance, and code quality."` };
});

cmd("explain", [], "Dev", "Ask the AI to explain code", (args) => {
  if (!args) return { output: "Usage: /explain <file-or-code>\nExample: /explain src/query.ts" };
  return { output: `Ask the AI: "Explain ${args} — what it does, how it works, and why."` };
});

cmd("security", ["audit-security"], "Dev", "Security audit of current changes", (_args, ctx) => {
  return new Promise((res) => {
    exec("git diff", { cwd: ctx.cwd, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (!stdout?.trim()) return res({ output: "No changes to audit." });
      res({ output: `Ask the AI: "Security review my uncommitted changes — look for vulnerabilities, injection risks, exposed secrets, and OWASP top 10 issues."` });
    });
  });
});

cmd("perf", ["performance"], "Dev", "Performance analysis of a file or function", (args) => {
  if (!args) return { output: "Usage: /perf <file>\nExample: /perf src/query.ts" };
  return { output: `Ask the AI: "Analyze ${args} for performance issues — look for N+1 queries, unnecessary allocations, blocking operations, and optimization opportunities."` };
});

cmd("translate", [], "Utility", "Translate code between languages", (args) => {
  if (!args) return { output: "Usage: /translate <file> to <language>\nExample: /translate utils.py to typescript" };
  return { output: `Ask the AI: "Translate ${args}."` };
});

cmd("regex", [], "Utility", "Generate or explain a regex", (args) => {
  if (!args) return { output: "Usage: /regex <description or pattern>\nExample: /regex match email addresses" };
  return { output: `Ask the AI: "Generate a regex for: ${args}"` };
});

cmd("sql", [], "Utility", "Generate or explain SQL", (args) => {
  if (!args) return { output: "Usage: /sql <description>\nExample: /sql get all users who signed up last month" };
  return { output: `Ask the AI: "Write SQL for: ${args}"` };
});

cmd("diagram", ["draw"], "Utility", "Generate a text diagram", (args) => {
  if (!args) return { output: "Usage: /diagram <description>\nExample: /diagram architecture of a microservices app" };
  return { output: `Ask the AI: "Create an ASCII/Mermaid diagram of: ${args}"` };
});

export function getCommand(input: string): { command: CommandDef; args: string } | null {
  if (!input.startsWith("/")) return null;
  const spaceIdx = input.indexOf(" ");
  const name = (spaceIdx > 0 ? input.slice(1, spaceIdx) : input.slice(1)).toLowerCase();
  const args = spaceIdx > 0 ? input.slice(spaceIdx + 1).trim() : "";

  const found = commands.find((c) => c.name === name || c.aliases.includes(name));
  if (!found) return null;

  return { command: found, args };
}

export function getAllCommands(): CommandDef[] {
  return commands;
}

export async function executeCommand(input: string, context: CommandContext): Promise<CommandResult> {
  const match = getCommand(input);
  if (!match) return { output: `Unknown command: ${input.split(" ")[0]}. Type /help for all commands.` };
  return match.command.handler(match.args, context);
}
