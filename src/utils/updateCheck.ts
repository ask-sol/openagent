import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getConfigDir } from "../config/settings.js";
import { detectInstallMethod, isWindows } from "./platform.js";

const CURRENT_VERSION = "0.1.59-20260426";
const CHECK_INTERVAL = 1000 * 60 * 60 * 4;
const CHECK_FILE = "last-update-check.json";

interface CheckData {
  lastCheck: number;
  latestVersion: string;
}

function getCheckPath(): string {
  return join(getConfigDir(), CHECK_FILE);
}

function parseVersion(v: string): number[] {
  const base = v.split("-")[0];
  return base.split(".").map(Number);
}

function isNewer(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }
  const rDate = remote.split("-")[1] || "0";
  const lDate = local.split("-")[1] || "0";
  return rDate > lDate;
}

function loadCheckData(): CheckData {
  const path = getCheckPath();
  if (!existsSync(path)) return { lastCheck: 0, latestVersion: CURRENT_VERSION };
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { lastCheck: 0, latestVersion: CURRENT_VERSION };
  }
}

function saveCheckData(data: CheckData): void {
  writeFileSync(getCheckPath(), JSON.stringify(data));
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}

export async function checkForUpdate(): Promise<string | null> {
  const data = loadCheckData();

  if (Date.now() - data.lastCheck < CHECK_INTERVAL) {
    if (isNewer(data.latestVersion, CURRENT_VERSION)) {
      return data.latestVersion;
    }
    return null;
  }

  try {
    const res = await fetch(
      "https://api.github.com/repos/ask-sol/openagent/releases/latest",
      { signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) {
      saveCheckData({ lastCheck: Date.now(), latestVersion: CURRENT_VERSION });
      return null;
    }

    const release = await res.json() as Record<string, any>;
    const latest = (release.tag_name || "").replace(/^v/, "");

    saveCheckData({ lastCheck: Date.now(), latestVersion: latest || CURRENT_VERSION });

    if (latest && isNewer(latest, CURRENT_VERSION)) {
      return latest;
    }

    return null;
  } catch {
    saveCheckData({ lastCheck: Date.now(), latestVersion: data.latestVersion });
    return null;
  }
}

export async function runUpgrade(): Promise<void> {
  const { spawn } = await import("node:child_process");
  const { LiveProgress, BrewParser } = await import("./progressBar.js");

  const progress = new LiveProgress("Upgrading OpenAgent");
  progress.start();

  const shellCmd = isWindows() ? "powershell.exe" : "/bin/bash";
  const shellArgs = isWindows() ? ["-NoProfile", "-Command"] : ["-c"];

  const runPiped = (cmd: string, timeoutMs: number, onChunk: (chunk: string) => void) =>
    new Promise<number>((resolve) => {
      const child = spawn(shellCmd, [...shellArgs, cmd], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
      const handleData = (d: Buffer) => onChunk(d.toString());
      child.stdout?.on("data", handleData);
      child.stderr?.on("data", handleData);
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve(code ?? 1);
      });
      child.on("error", () => {
        clearTimeout(timer);
        resolve(1);
      });
    });

  const detail = (chunk: string) => {
    const line = chunk.trim().split("\n").pop() || "";
    if (line) progress.update({ detail: line.slice(0, 80) });
  };

  const manualPath = join(homedir(), ".openagent", "app");
  const manualCmd = isWindows()
    ? `cd '${manualPath}'; git pull; npm install`
    : "cd ~/.openagent/app && git pull && npm install 2>&1";
  const npmCmd = "npm install -g openagent@latest";

  const tryBrew = async () => {
    progress.update({ percent: 2, phase: "Refreshing tap", detail: "" });
    const tapCode = await runPiped(
      "cd $(brew --repository)/Library/Taps/ask-sol/homebrew-openagent && git pull 2>&1",
      30000,
      detail,
    );
    if (tapCode !== 0) throw new Error("tap refresh failed");

    const parser = new BrewParser();
    progress.update({ percent: 8, phase: "Fetching", detail: "" });
    const brewCode = await runPiped(
      "brew reinstall openagent 2>&1",
      300000,
      (chunk) => {
        const state = parser.feed(chunk);
        progress.update({
          percent: Math.max(8, state.percent),
          phase: state.phase,
          detail: state.detail,
        });
      },
    );
    if (brewCode !== 0) throw new Error("brew reinstall failed");
  };

  const tryNpm = async () => {
    progress.update({ percent: 30, phase: "Updating via npm", detail: "" });
    const code = await runPiped(npmCmd, 180000, detail);
    if (code !== 0) throw new Error("npm install -g failed");
  };

  const tryManual = async () => {
    if (!existsSync(manualPath)) throw new Error("manual install not present");
    progress.update({ percent: 60, phase: "Updating from source", detail: "" });
    const code = await runPiped(manualCmd, 180000, detail);
    if (code !== 0) throw new Error("manual update failed");
  };

  const method = detectInstallMethod();
  const attempts: Array<{ name: string; fn: () => Promise<void> }> = [];

  if (method === "brew" && !isWindows()) {
    attempts.push({ name: "brew", fn: tryBrew });
    attempts.push({ name: "npm", fn: tryNpm });
    attempts.push({ name: "manual", fn: tryManual });
  } else if (method === "npm-global") {
    attempts.push({ name: "npm", fn: tryNpm });
    attempts.push({ name: "manual", fn: tryManual });
  } else if (method === "manual") {
    attempts.push({ name: "manual", fn: tryManual });
    attempts.push({ name: "npm", fn: tryNpm });
  } else {
    if (!isWindows()) attempts.push({ name: "brew", fn: tryBrew });
    attempts.push({ name: "npm", fn: tryNpm });
    attempts.push({ name: "manual", fn: tryManual });
  }

  for (const a of attempts) {
    try {
      await a.fn();
      progress.finish(`OpenAgent upgraded successfully (${a.name}).`);
      return;
    } catch {
      // try next
    }
  }

  progress.fail(
    isWindows()
      ? "Update failed. Try: npm install -g openagent@latest"
      : "Update failed. Try: brew reinstall openagent",
  );
  process.exit(1);
}
