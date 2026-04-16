import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "../config/settings.js";

const CURRENT_VERSION = "0.1.1-20260416";
const CHECK_INTERVAL = 1000 * 60 * 60 * 4;
const CHECK_FILE = "last-update-check.json";

interface CheckData {
  lastCheck: number;
  latestVersion: string;
}

function getCheckPath(): string {
  return join(getConfigDir(), CHECK_FILE);
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
    if (data.latestVersion !== CURRENT_VERSION) {
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

    if (latest && latest !== CURRENT_VERSION) {
      return latest;
    }

    return null;
  } catch {
    saveCheckData({ lastCheck: Date.now(), latestVersion: data.latestVersion });
    return null;
  }
}

export async function runUpgrade(): Promise<void> {
  const { execSync } = await import("node:child_process");

  console.log("Upgrading OpenAgent...\n");

  try {
    execSync("brew reinstall openagent 2>&1", {
      stdio: "inherit",
      timeout: 120000,
    });
    console.log("\nOpenAgent upgraded successfully.");
  } catch {
    console.log("\nBrew upgrade failed. Trying manual update...\n");
    try {
      execSync("cd ~/.openagent/app && git pull && npm install 2>&1", {
        stdio: "inherit",
        timeout: 120000,
      });
      console.log("\nOpenAgent updated successfully.");
    } catch {
      console.error("Update failed. Try manually: brew reinstall openagent");
      process.exit(1);
    }
  }
}
