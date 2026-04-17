import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "../config/settings.js";

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const AUTH_URL = "https://platform.claude.com/oauth/authorize";
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const SCOPES = "user:profile user:inference";

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

    if (!res.ok) return null;

    const data = await res.json() as Record<string, any>;
    const updated: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
    saveOAuthTokens(updated);
    return updated.accessToken;
  } catch {
    return null;
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
          res.end("<h2>State mismatch. Try again.</h2>");
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h2>Authorization denied.</h2>");
          server.close();
          resolve({ success: false, error: "Authorization denied" });
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>OpenAgent connected to Claude! You can close this tab.</h2>");

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

export function getOAuthApiKey(): string | null {
  const tokens = loadOAuthTokens();
  if (!tokens) return null;
  return tokens.accessToken;
}
