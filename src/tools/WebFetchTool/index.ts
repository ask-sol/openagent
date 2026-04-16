import type { Tool, ToolResult, ToolContext } from "../types.js";

export const webFetchTool: Tool = {
  name: "WebFetch",
  description:
    "Fetch a URL and return its content. Strips HTML tags by default for readability.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to fetch",
      },
      raw: {
        type: "boolean",
        description: "Return raw HTML instead of stripped text",
      },
      max_length: {
        type: "number",
        description: "Max characters to return (default 50000)",
      },
    },
    required: ["url"],
  },

  async execute(
    input: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    const url = input.url as string;
    const raw = (input.raw as boolean) || false;
    const maxLength = (input.max_length as number) || 50000;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html,application/json,text/plain,*/*",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        return { output: "", error: `Fetch failed: ${response.status} ${response.statusText}` };
      }

      let content = await response.text();

      if (!raw && response.headers.get("content-type")?.includes("html")) {
        content = content
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, " ")
          .trim();
      }

      if (content.length > maxLength) {
        content = content.slice(0, maxLength) + "\n... (truncated)";
      }

      return { output: content };
    } catch (err: any) {
      return { output: "", error: `Fetch failed: ${err.message}` };
    }
  },
};
