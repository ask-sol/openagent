import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "../config/settings.js";

const CURRENT_VERSION = "0.1.41-20260425";
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

  const runPiped = (cmd: string, timeoutMs: number, onChunk: (chunk: string) => void) =>
    new Promise<number>((resolve) => {
      const child = spawn("/bin/bash", ["-c", cmd], { stdio: ["ignore", "pipe", "pipe"] });
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

  try {
    progress.update({ percent: 2, phase: "Refreshing tap", detail: "" });
    const tapCode = await runPiped(
      "cd $(brew --repository)/Library/Taps/ask-sol/homebrew-openagent && git pull 2>&1",
      30000,
      (chunk) => {
        const line = chunk.trim().split("\n").pop() || "";
        if (line) progress.update({ detail: line.slice(0, 80) });
      },
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

    progress.finish("OpenAgent upgraded successfully.");
  } catch {
    progress.update({ percent: 60, phase: "Falling back to git pull", detail: "" });
    try {
      const fallbackCode = await runPiped(
        "cd ~/.openagent/app && git pull && npm install 2>&1",
        180000,
        (chunk) => {
          const line = chunk.trim().split("\n").pop() || "";
          if (line) progress.update({ detail: line.slice(0, 80) });
        },
      );
      if (fallbackCode !== 0) throw new Error("fallback failed");
      progress.finish("OpenAgent updated from source.");
    } catch {
      progress.fail("Update failed. Try: brew reinstall openagent");
      process.exit(1);
    }
  }
}
