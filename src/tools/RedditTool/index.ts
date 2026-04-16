import type { Tool, ToolResult, ToolContext } from "../types.js";
import { loadSettings } from "../../config/settings.js";

async function getRedditAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "OpenAgent/0.1.0",
    },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
  });

  if (!response.ok) {
    throw new Error(`Reddit auth failed: ${response.status}`);
  }

  const data = await response.json() as Record<string, any>;
  return data.access_token;
}

export const redditPostTool: Tool = {
  name: "RedditPost",
  description:
    "Post content to Reddit. Can create text posts or link posts to a specified subreddit. Requires Reddit OAuth to be configured in setup.",
  parameters: {
    type: "object",
    properties: {
      subreddit: {
        type: "string",
        description: "Subreddit name without the r/ prefix",
      },
      title: {
        type: "string",
        description: "Post title",
      },
      content: {
        type: "string",
        description: "Post body text (for text posts)",
      },
      url: {
        type: "string",
        description: "URL to submit (for link posts)",
      },
      flair_id: {
        type: "string",
        description: "Flair ID if required by the subreddit",
      },
    },
    required: ["subreddit", "title"],
  },

  async execute(
    input: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    const settings = loadSettings();

    if (!settings.reddit) {
      return {
        output: "",
        error:
          "Reddit not configured. Run 'openagent' and use /setup to configure Reddit OAuth credentials.",
      };
    }

    try {
      const token = await getRedditAccessToken(
        settings.reddit.clientId,
        settings.reddit.clientSecret,
        settings.reddit.refreshToken
      );

      const formData = new URLSearchParams();
      formData.append("sr", input.subreddit as string);
      formData.append("title", input.title as string);
      formData.append("api_type", "json");

      if (input.url) {
        formData.append("kind", "link");
        formData.append("url", input.url as string);
      } else {
        formData.append("kind", "self");
        formData.append("text", (input.content as string) || "");
      }

      if (input.flair_id) {
        formData.append("flair_id", input.flair_id as string);
      }

      const response = await fetch("https://oauth.reddit.com/api/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "OpenAgent/0.1.0",
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const err = await response.text();
        return { output: "", error: `Reddit post failed: ${response.status} — ${err}` };
      }

      const data = await response.json() as Record<string, any>;

      if (data.json?.errors?.length > 0) {
        return {
          output: "",
          error: `Reddit post errors: ${JSON.stringify(data.json.errors)}`,
        };
      }

      const postUrl = data.json?.data?.url || "Post submitted";
      return { output: `Posted to r/${input.subreddit}: ${postUrl}` };
    } catch (err: any) {
      return { output: "", error: `Reddit post failed: ${err.message}` };
    }
  },
};
