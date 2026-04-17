function exec(cmd: string, opts?: Record<string, any>): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    import("node:child_process").then(({ exec: execCb }) => {
      execCb(cmd, { timeout: 30000, ...opts }, (err, stdout, stderr) => {
        resolve({ stdout: stdout || "", stderr: stderr || "", code: err?.code || 0 });
      });
    });
  });
}

export async function isClaudeInstalled(): Promise<boolean> {
  const { code } = await exec("claude --version");
  return code === 0;
}

export async function isClaudeLoggedIn(): Promise<boolean> {
  const { code } = await exec("claude auth status");
  return code === 0;
}

export async function installClaude(onProgress: (msg: string) => void): Promise<boolean> {
  onProgress("Installing Claude Code...");
  const { code } = await exec("npm install -g @anthropic-ai/claude-code 2>&1", { timeout: 120000 });
  if (code !== 0) {
    onProgress("Install failed. Run: npm install -g @anthropic-ai/claude-code");
    return false;
  }
  onProgress("Claude Code installed.");
  return true;
}

export async function setupClaudeMax(onProgress: (msg: string) => void): Promise<boolean> {
  onProgress("Checking Claude Code...");

  if (!(await isClaudeInstalled())) {
    const ok = await installClaude(onProgress);
    if (!ok) return false;
  }

  onProgress("Checking login...");
  if (!(await isClaudeLoggedIn())) {
    onProgress("Not logged in. Run: claude auth login");
    return false;
  }

  onProgress("Ready. Using your Max subscription.");
  return true;
}

export function getProxyConfig() {
  return {
    provider: "anthropic-max",
    model: "claude-sonnet-4-6",
    apiKey: "max-subscription",
    baseUrl: "",
  };
}
