import { createServer } from "node:http";
import { createHmac, randomBytes } from "node:crypto";
import { loadSettings, saveSettings } from "../../config/settings.js";

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauthSign(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret = ""
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join("&");
  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return createHmac("sha1", signingKey).update(baseString).digest("base64");
}

export async function setupX(): Promise<string> {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((res) => rl.question(q, res));

  console.log("\n  X (Twitter) Setup\n");
  console.log("  1. Go to: https://developer.x.com/en/portal/dashboard");
  console.log("  2. Create a project & app (or use existing)");
  console.log("  3. In your app settings, go to 'Keys and tokens'");
  console.log("  4. Under 'Consumer Keys', get your API Key and Secret");
  console.log("  5. Under 'Authentication settings':");
  console.log("     - Enable OAuth 1.0a");
  console.log("     - Set type to 'Read and Write'");
  console.log("     - Callback URL: http://localhost:8911/callback");
  console.log("  6. Under 'Access Token and Secret', generate them\n");

  const apiKey = await ask("  API Key (Consumer Key): ");
  const apiSecret = await ask("  API Secret (Consumer Secret): ");

  if (!apiKey.trim() || !apiSecret.trim()) {
    rl.close();
    return "Setup cancelled — missing credentials.";
  }

  console.log("\n  Choose method:");
  console.log("  1. I already have Access Token & Secret (easier)");
  console.log("  2. Authorize via browser (OAuth flow)\n");

  const method = await ask("  Choice (1 or 2): ");

  if (method.trim() === "1") {
    const accessToken = await ask("  Access Token: ");
    const accessSecret = await ask("  Access Token Secret: ");

    if (!accessToken.trim() || !accessSecret.trim()) {
      rl.close();
      return "Setup cancelled — missing tokens.";
    }

    const settings = loadSettings();
    settings.x = {
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      accessToken: accessToken.trim(),
      accessSecret: accessSecret.trim(),
    };
    saveSettings(settings);

    rl.close();
    return "X (Twitter) connected. You can now use /tweet or ask the AI to post.";
  }

  console.log("\n  Starting OAuth flow...");

  const requestTokenUrl = "https://api.twitter.com/oauth/request_token";
  const callbackUrl = "http://localhost:8911/callback";
  const nonce = randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_callback: callbackUrl,
    oauth_consumer_key: apiKey.trim(),
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_version: "1.0",
  };

  oauthParams.oauth_signature = oauthSign("POST", requestTokenUrl, oauthParams, apiSecret.trim());

  const authHeader = "OAuth " + Object.keys(oauthParams).sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ");

  const reqTokenRes = await fetch(requestTokenUrl, {
    method: "POST",
    headers: { Authorization: authHeader },
  });

  if (!reqTokenRes.ok) {
    rl.close();
    const err = await reqTokenRes.text();
    return `Failed to get request token: ${err}`;
  }

  const reqTokenBody = await reqTokenRes.text();
  const reqTokenParams = new URLSearchParams(reqTokenBody);
  const oauthToken = reqTokenParams.get("oauth_token") || "";
  const oauthTokenSecret = reqTokenParams.get("oauth_token_secret") || "";

  const authorizeUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`;

  console.log("\n  Opening browser for authorization...\n");
  const { exec } = await import("node:child_process");
  exec(`open "${authorizeUrl}"`);

  console.log("  If browser didn't open, go to:");
  console.log(`  ${authorizeUrl}\n`);
  console.log("  Waiting for authorization...");

  const verifier = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Timed out (60s)"));
    }, 60000);

    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", "http://localhost:8911");
      if (url.pathname === "/callback") {
        const v = url.searchParams.get("oauth_verifier");
        if (v) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h2>OpenAgent authorized! You can close this tab.</h2>");
          clearTimeout(timeout);
          server.close();
          resolve(v);
        } else {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h2>Authorization denied.</h2>");
          clearTimeout(timeout);
          server.close();
          reject(new Error("Denied"));
        }
      }
    });

    server.listen(8911);
  });

  const accessTokenUrl = "https://api.twitter.com/oauth/access_token";
  const accessRes = await fetch(`${accessTokenUrl}?oauth_token=${oauthToken}&oauth_verifier=${verifier}`, {
    method: "POST",
  });

  if (!accessRes.ok) {
    rl.close();
    return `Failed to exchange token: ${await accessRes.text()}`;
  }

  const accessBody = await accessRes.text();
  const accessParams = new URLSearchParams(accessBody);
  const accessToken = accessParams.get("oauth_token") || "";
  const accessSecret = accessParams.get("oauth_token_secret") || "";
  const screenName = accessParams.get("screen_name") || "";

  const settings = loadSettings();
  settings.x = {
    apiKey: apiKey.trim(),
    apiSecret: apiSecret.trim(),
    accessToken,
    accessSecret,
  };
  saveSettings(settings);

  rl.close();
  return `X connected as @${screenName}. You can now use /tweet or ask the AI to post.`;
}
