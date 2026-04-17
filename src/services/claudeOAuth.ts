import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "../config/settings.js";

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const AUTH_URL = "https://claude.com/cai/oauth/authorize";
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const SCOPES = "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";

function callbackPage(title: string, message: string, success: boolean): string {
  const color = success ? "#22c55e" : "#ef4444";
  const icon = success ? "✓" : "✗";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OpenAgent</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff}
.card{text-align:center;padding:3rem;border-radius:16px;background:#111;border:1px solid #222;max-width:420px}
.icon{font-size:3rem;width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;background:${color}15;border:2px solid ${color}}
h1{font-size:1.5rem;margin-bottom:0.5rem;color:${color}}
p{color:#888;line-height:1.6}
.brand{margin-top:2rem;color:#444;font-size:0.8rem}
</style></head><body>
<div class="card">
<div class="icon" style="color:${color}">${icon}</div>
<h1>${title}</h1>
<p>${message}</p>
<p class="brand">OpenAgent</p>
</div></body></html>`;
}

interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function getCredentialsPath(): string {
  return join(getConfigDir(), ".claude-oauth.json");
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(64));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function loadOAuthTokens(): OAuthTokens | null {
  const path = getCredentialsPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function saveOAuthTokens(tokens: OAuthTokens): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getCredentialsPath(), JSON.stringify(tokens, null, 2));
}

async function createApiKeyFromOAuth(oauthToken: string): Promise<string | null> {
  try {
    const res = await fetch(CREATE_KEY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oauthToken}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ name: "openagent-session" }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("API key creation failed:", err);
      return null;
    }

    const data = await res.json() as Record<string, any>;
    return data.api_key || data.key || null;
  } catch {
    return null;
  }
}

export async function refreshTokenIfNeeded(): Promise<string | null> {
  const tokens = loadOAuthTokens();
  if (!tokens) return null;

  if (Date.now() < tokens.expiresAt - 60000) {
    return tokens.accessToken;
  }

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
        client_id: CLIENT_ID,
        scope: SCOPES,
      }).toString(),
    });

    if (!res.ok) return tokens.accessToken;

    const data = await res.json() as Record<string, any>;
    const newToken = data.access_token;
    saveOAuthTokens({
      accessToken: newToken,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    });
    return newToken;
  } catch {
    return tokens.accessToken;
  }
}

export async function startOAuthLogin(): Promise<{ success: boolean; error?: string }> {
  const { verifier, challenge } = generatePKCE();
  const state = randomUUID();

  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://localhost`);

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");

        if (returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(callbackPage("Error", "State mismatch. Please try again.", false));
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(callbackPage("Denied", "Authorization was denied.", false));
          server.close();
          resolve({ success: false, error: "Authorization denied" });
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(callbackPage("Connected", "OpenAgent is connected to Claude. You can close this tab.", true));

        try {
          const tokenRes = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              redirect_uri: `http://localhost:${port}/callback`,
              client_id: CLIENT_ID,
              code_verifier: verifier,
              state,
            }).toString(),
          });

          if (!tokenRes.ok) {
            const err = await tokenRes.text();
            server.close();
            resolve({ success: false, error: `Token exchange failed: ${err}` });
            return;
          }

          const data = await tokenRes.json() as Record<string, any>;
          saveOAuthTokens({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
          });

          server.close();
          resolve({ success: true });
        } catch (err: any) {
          server.close();
          resolve({ success: false, error: err.message });
        }
      }
    });

    server.listen(0);
    const port = (server.address() as any).port;

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: `http://localhost:${port}/callback`,
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });

    const authUrl = `${AUTH_URL}?${params.toString()}`;

    import("node:child_process").then(({ exec }) => {
      const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      exec(`${openCmd} "${authUrl}"`);
    });

    console.log(`\n  Opening browser for Claude login...`);
    console.log(`  If it doesn't open, go to:\n  ${authUrl}\n`);

    setTimeout(() => {
      server.close();
      resolve({ success: false, error: "Login timed out (120s)" });
    }, 120000);
  });
}

export async function getOAuthApiKey(): Promise<string | null> {
  const tokens = loadOAuthTokens();
  if (!tokens) return null;
  const apiKey = await createApiKeyFromOAuth(tokens.accessToken);
  return apiKey;
}
