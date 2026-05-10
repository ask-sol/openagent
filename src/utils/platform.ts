import { exec, spawn, type ExecOptions, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir, release } from "node:os";
import { join } from "node:path";

export type OSKind = "windows" | "macos" | "linux" | "wsl" | "unknown";

let _cachedKind: OSKind | undefined;

export function osKind(): OSKind {
  if (_cachedKind) return _cachedKind;
  switch (process.platform) {
    case "win32":
      _cachedKind = "windows";
      break;
    case "darwin":
      _cachedKind = "macos";
      break;
    case "linux":
      _cachedKind = isWSLEnv() ? "wsl" : "linux";
      break;
    default:
      _cachedKind = "unknown";
  }
  return _cachedKind;
}

function isWSLEnv(): boolean {
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  try {
    const r = release().toLowerCase();
    if (r.includes("microsoft") || r.includes("wsl")) return true;
    if (existsSync("/proc/version")) {
      const v = readFileSync("/proc/version", "utf-8").toLowerCase();
      if (v.includes("microsoft") || v.includes("wsl")) return true;
    }
  } catch {}
  return false;
}

export const isWindows = () => osKind() === "windows";
export const isMac = () => osKind() === "macos";
export const isLinux = () => osKind() === "linux";
export const isWSL = () => osKind() === "wsl";
export const isPosix = () => !isWindows();

export function osLabel(): string {
  switch (osKind()) {
    case "windows":
      return "Windows";
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    case "wsl":
      return "WSL";
    default:
      return process.platform;
  }
}

export function nullDevice(): string {
  return isWindows() ? "NUL" : "/dev/null";
}

export function silenceStderr(cmd: string): string {
  return isWindows() ? `${cmd} 2>NUL` : `${cmd} 2>/dev/null`;
}

export function pipeHead(cmd: string, n: number): string {
  return isWindows()
    ? `powershell -NoProfile -Command "& { ${cmd.replace(/"/g, '\\"')} } | Select-Object -First ${n}"`
    : `${cmd} | head -${n}`;
}

export interface RunOptions extends ExecOptions {
  timeout?: number;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  error?: Error;
}

export function run(cmd: string, opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = exec(
      cmd,
      {
        ...opts,
        shell: opts.shell ?? defaultShell(),
        windowsHide: true,
        maxBuffer: opts.maxBuffer ?? 1024 * 1024 * 10,
      },
      (err, stdout, stderr) => {
        resolve({
          code: err && typeof (err as any).code === "number" ? (err as any).code : err ? 1 : 0,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          error: err || undefined,
        });
      }
    );
    if (opts.signal) {
      opts.signal.addEventListener("abort", () => child.kill("SIGTERM"));
    }
  });
}

export function defaultShell(): string {
  if (isWindows()) {
    return process.env.COMSPEC || "cmd.exe";
  }
  return process.env.SHELL || "/bin/sh";
}

export async function commandExists(name: string): Promise<boolean> {
  const probe = isWindows() ? `where ${name}` : `command -v ${name}`;
  const { code } = await run(probe, { timeout: 5000 });
  return code === 0;
}

export function spawnDetached(cmd: string, args: string[]): ChildProcess {
  const child = spawn(cmd, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: false,
  });
  child.unref();
  return child;
}

export function openUrl(url: string): void {
  let cmd: string;
  let args: string[];
  if (isWindows()) {
    cmd = "cmd.exe";
    args = ["/c", "start", "", url];
  } else if (isMac()) {
    cmd = "open";
    args = [url];
  } else if (isWSL()) {
    cmd = "cmd.exe";
    args = ["/c", "start", "", url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } catch {}
}

export type InstallMethod = "brew" | "npm-global" | "manual" | "unknown";

export function detectInstallMethod(): InstallMethod {
  const exe = process.argv[1] || "";
  const lower = exe.toLowerCase();
  if (lower.includes("/cellar/openagent/") || lower.includes("homebrew")) return "brew";
  if (lower.includes("/node_modules/") || lower.includes("\\node_modules\\")) return "npm-global";
  const manualPath = join(homedir(), ".openagent", "app");
  if (lower.includes(manualPath.toLowerCase())) return "manual";
  return "unknown";
}

export function homeConfigDir(): string {
  return join(homedir(), ".openagent");
}
