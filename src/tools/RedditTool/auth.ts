import { createServer } from "node:http";
import { loadSettings, saveSettings } from "../../config/settings.js";

const REDIRECT_URI = "http://localhost:8910/callback";
const SCOPES = "submit identity read";

export async function setupReddit(): Promise<string> {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((res) => rl.question(q, res));

  console.log("\n  Reddit Setup\n");
  console.log("  1. Go to: https://www.reddit.com/prefs/apps");
  console.log("  2. Scroll down, click 'create another app...'");
  console.log("  3. Fill in:");
  console.log("     - Name: OpenAgent");
  console.log("     - Type: select 'web app'");
  console.log(`     - Redirect URI: ${REDIRECT_URI}`);
  console.log("  4. Click 'create app'\n");

  const clientId = await ask("  Client ID (short string under app name): ");
  const clientSecret = await ask("  Client Secret: ");
  const username = await ask("  Reddit username: ");

  if (!clientId.trim() || !clientSecret.trim()) {
    rl.close();
    return "Setup cancelled — missing credentials.";
  }

  console.log("\n  Opening browser for authorization...\n");

  const state = Math.random().toString(36).slice(2);
  const authUrl = `https://www.reddit.com/api/v1/authorize?client_id=${clientId.trim()}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&duration=permanent&scope=${encodeURIComponent(SCOPES)}`;

  const { exec } = await import("node:child_process");
  exec(`open "${authUrl}"`);

  console.log("  If browser didn't open, go to:");
  console.log(`  ${authUrl}\n`);
  console.log("  Waiting for authorization...");

  const code = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for authorization (60s)"));
    }, 60000);

    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", `http://localhost:8910`);
      if (url.pathname === "/callback") {
        const authCode = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");

        if (returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h2>State mismatch. Try again.</h2>");
          return;
        }

        if (authCode) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h2>OpenAgent authorized! You can close this tab.</h2>");
          clearTimeout(timeout);
          server.close();
          resolve(authCode);
        } else {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h2>Authorization denied.</h2>");
          clearTimeout(timeout);
          server.close();
          reject(new Error("Authorization denied by user"));
        }
      }
    });

    server.listen(8910);
  });

  console.log("  Got authorization code. Exchanging for token...");

  const auth = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString("base64");
  const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "OpenAgent/0.1.0",
    },
    body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
  });

  if (!tokenRes.ok) {
    rl.close();
    const err = await tokenRes.text();
    return `Token exchange failed: ${err}`;
  }

  const tokenData = await tokenRes.json() as Record<string, any>;

  if (!tokenData.refresh_token) {
    rl.close();
    return "Failed — no refresh token received. Make sure you selected 'web app' type.";
  }

  const settings = loadSettings();
  settings.reddit = {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    refreshToken: tokenData.refresh_token,
    username: username.trim(),
  };
  saveSettings(settings);

  rl.close();
  return `Reddit connected as u/${username.trim()}. You can now use /reddit or ask the AI to post.`;
}
