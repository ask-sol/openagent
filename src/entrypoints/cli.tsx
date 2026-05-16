#!/usr/bin/env node

import React from "react";
import { render } from "ink";
import { Command } from "commander";
import { App } from "../components/App.js";
import { loadSettings, saveSettings } from "../config/settings.js";
import { listSessions } from "../session/history.js";
import { getBanner } from "../utils/terminal.js";
import {
  loadPermissions,
  savePermissions,
  isUnrestrictedConfirmedForDir,
  confirmUnrestrictedForDir,
} from "../config/permissions.js";
import { checkForUpdate, runUpgrade, getCurrentVersion } from "../utils/updateCheck.js";

const program = new Command();

program
  .name("openagent")
  .description("Open-source agentic coding CLI — multi-provider, token-efficient, extensible")
  .version("0.1.62-20260516")
  .option("--setup", "Run the setup wizard")
  .option("--provider <id>", "Override provider (openai, anthropic, gemini, etc.)")
  .option("--model <id>", "Override model")
  .option("--mode <mode>", "Response mode: concise or explanative")
  .option("--sessions", "List recent sessions")
  .option("-u, --unrestricted", "Run in unrestricted mode (no permission prompts)")
  .option("-c, --cautious", "Run in cautious mode (prompt before every tool)")
  .option("-t, --think", "Enable thinking/reasoning mode")
  .option("--upgrade", "Upgrade OpenAgent to the latest version")
  .option("--prompt <text>", "Headless one-shot mode: run a single prompt and exit. Used by Wyrd's Re-execute feature.")
  .action(async (options) => {
    if (options.upgrade) {
      await runUpgrade();
      return;
    }

    // Headless one-shot mode (for Wyrd Re-execute, scripting, etc.). Runs a
    // single query loop against the configured provider with no TUI, streams
    // output to stdout, exits when done. WYRD_ENABLED is honored as usual.
    if (typeof options.prompt === "string" && options.prompt.length > 0) {
      if (options.provider || options.model || options.mode) {
        const s = loadSettings();
        if (options.provider) s.provider = options.provider;
        if (options.model) s.model = options.model;
        if (options.mode) s.responseMode = options.mode;
        saveSettings(s);
      }
      const settings = loadSettings();
      const { getProvider } = await import("../providers/index.js");
      const { runQueryLoop } = await import("../query.js");
      const { createSession } = await import("../session/history.js");
      const provider = getProvider(settings.provider);
      if (!provider) {
        process.stderr.write(`error: provider "${settings.provider}" not configured. Run \`openagent --setup\` first.\n`);
        process.exit(1);
      }
      const sessionMeta = createSession(process.cwd(), settings.provider, settings.model);
      const sessionId = sessionMeta.id;
      const messages = [{ role: "user" as const, content: options.prompt }];
      const aborter = new AbortController();
      process.on("SIGINT", () => aborter.abort());
      const callbacks = {
        onText: (t: string) => process.stdout.write(t),
        onToolStart: (name: string) => process.stderr.write(`\n[tool:start] ${name}\n`),
        onToolEnd: (name: string, _id: string, _result: string, err?: string) => {
          process.stderr.write(`[tool:end] ${name}${err ? ` error=${err}` : ""}\n`);
        },
        onToolPermission: async () => true, // headless: auto-allow. Caller scopes via --unrestricted policy.
        onDone: (usage: { inputTokens: number; outputTokens: number }) => {
          process.stderr.write(
            `\n[done] ${usage.inputTokens}↓ ${usage.outputTokens}↑\n`,
          );
        },
        onError: (e: string) => process.stderr.write(`\n[error] ${e}\n`),
      };
      try {
        await runQueryLoop(provider, messages, sessionId, callbacks, options.think ?? false, aborter.signal);
        process.exit(0);
      } catch (err) {
        process.stderr.write(`\n[fatal] ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(2);
      }
    }

    if (options.sessions) {
      const sessions = listSessions(process.cwd());
      if (sessions.length === 0) {
        console.log("No sessions found for this directory.");
      } else {
        console.log(getBanner(process.stdout.columns || 80));
        console.log("Recent sessions:\n");
        sessions.slice(0, 20).forEach((s, i) => {
          const date = new Date(s.lastActiveAt).toLocaleString();
          console.log(`  ${i + 1}. ${s.summary || "(no summary)"}`);
          console.log(`     ${date} — ${s.messageCount} messages — ${s.provider}/${s.model}`);
        });
        console.log("\nRun: openagent --resume <number>");
      }
      return;
    }

    if (options.unrestricted) {
      const cwd = process.cwd();
      if (!isUnrestrictedConfirmedForDir(cwd)) {
        const readline = await import("node:readline");
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>((resolve) => {
          console.log("\n⚠️  Unrestricted mode disables ALL permission prompts.");
          console.log("   The AI can execute any command, modify any file, and make network requests without asking.\n");
          rl.question("   Enable unrestricted mode for this directory? (yes/no): ", resolve);
        });
        rl.close();
        if (answer.toLowerCase() !== "yes" && answer.toLowerCase() !== "y") {
          console.log("Cancelled. Starting in standard mode.");
        } else {
          confirmUnrestrictedForDir(cwd);
          console.log("Unrestricted mode enabled for this directory.\n");
        }
      } else {
        const state = loadPermissions();
        state.mode = "unrestricted";
        savePermissions(state);
      }
    }

    if (options.cautious) {
      const state = loadPermissions();
      state.mode = "cautious";
      savePermissions(state);
    }

    if (options.provider || options.model || options.mode) {
      const settings = loadSettings();
      if (options.provider) settings.provider = options.provider;
      if (options.model) settings.model = options.model;
      if (options.mode) settings.responseMode = options.mode;
      saveSettings(settings);
    }

    const newVersion = await checkForUpdate().catch(() => null);
    if (newVersion) {
      console.log(`\n  \x1b[33m⬆ Update available: v${newVersion}\x1b[0m (current: v${getCurrentVersion()})`);
      console.log(`  Run \x1b[36mopenagent --upgrade\x1b[0m to update\n`);
    }

    const forceSetup = options.setup || false;

    if (forceSetup) {
      const { unlinkSync, existsSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { homedir } = await import("node:os");
      const oauthPath = join(homedir(), ".openagent", ".claude-oauth.json");
      const configPath = join(homedir(), ".openagent", "config.json");
      if (existsSync(oauthPath)) unlinkSync(oauthPath);
      if (existsSync(configPath)) unlinkSync(configPath);
    }
    const thinkingEnabled = options.think || false;

    const { waitUntilExit } = render(
      <App forceSetup={forceSetup} thinkingEnabled={thinkingEnabled} />,
      {
        exitOnCtrlC: true,
      }
    );

    await waitUntilExit();
  });

program.parse();
