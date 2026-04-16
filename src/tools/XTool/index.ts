import { createHmac, randomBytes } from "node:crypto";
import type { Tool, ToolResult, ToolContext } from "../types.js";
import { loadSettings } from "../../config/settings.js";

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function generateOAuthHeader(
  method: string,
  url: string,
  params: Record<string, string>,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const allParams = { ...oauthParams, ...params };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys.map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`).join("&");

  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");

  oauthParams.oauth_signature = signature;

  const header = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${header}`;
}

export const xPostTool: Tool = {
  name: "XPost",
  description:
    "Post a tweet to X (Twitter). Requires a paid X API plan ($100/mo Basic tier) and credentials configured via /setup-x.",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The tweet text (max 280 characters)",
      },
      reply_to: {
        type: "string",
        description: "Tweet ID to reply to (optional)",
      },
    },
    required: ["text"],
  },

  async execute(
    input: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    const settings = loadSettings();

    if (!settings.x) {
      return {
        output: "",
        error:
          "X (Twitter) not configured. Run 'openagent' and use /setup to configure X API credentials.",
      };
    }

    const text = input.text as string;
    if (text.length > 280) {
      return { output: "", error: `Tweet too long (${text.length}/280 chars)` };
    }

    try {
      const url = "https://api.x.com/2/tweets";
      const body: Record<string, unknown> = { text };

      if (input.reply_to) {
        body.reply = { in_reply_to_tweet_id: input.reply_to };
      }

      const authHeader = generateOAuthHeader(
        "POST",
        url,
        {},
        settings.x.apiKey,
        settings.x.apiSecret,
        settings.x.accessToken,
        settings.x.accessSecret
      );

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          "User-Agent": "OpenAgent/0.1.0",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        return { output: "", error: `X post failed: ${response.status} — ${err}` };
      }

      const data = await response.json() as Record<string, any>;
      const tweetId = data.data?.id;
      return {
        output: `Posted to X: https://x.com/i/status/${tweetId}`,
      };
    } catch (err: any) {
      return { output: "", error: `X post failed: ${err.message}` };
    }
  },
};
