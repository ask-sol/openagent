import type { Tool, ToolResult, ToolContext } from "../types.js";

async function searchDDGLite(query: string, maxResults: number): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const response = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept": "text/html",
    },
  });

  if (!response.ok) return [];

  const html = await response.text();
  const results: Array<{ title: string; url: string; snippet: string }> = [];

  const rows = html.split("<tr>").slice(1);
  let currentTitle = "";
  let currentUrl = "";

  for (const row of rows) {
    if (results.length >= maxResults) break;

    const linkMatch = row.match(/<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (linkMatch) {
      currentUrl = linkMatch[1];
      currentTitle = linkMatch[2].replace(/<[^>]+>/g, "").trim();
      continue;
    }

    const snippetMatch = row.match(/class="result-snippet"[^>]*>([\s\S]*?)<\/td>/);
    if (snippetMatch && currentTitle) {
      const snippet = snippetMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (currentTitle && currentUrl) {
        results.push({ title: currentTitle, url: currentUrl, snippet });
      }
      currentTitle = "";
      currentUrl = "";
    }
  }

  return results;
}

async function searchDDGHTML(query: string, maxResults: number): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `q=${encodeURIComponent(query)}`,
  });

  if (!response.ok) return [];

  const html = await response.text();
  const results: Array<{ title: string; url: string; snippet: string }> = [];

  const linkPattern = /<a rel="nofollow" class="result__a" href="([^"]*)">([\s\S]*?)<\/a>/g;
  const snippetPattern = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const urlPattern = /<a class="result__url"[^>]*href="([^"]*)"[^>]*>/g;

  const links: Array<{ title: string; rawHref: string }> = [];
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    links.push({
      rawHref: match[1],
      title: match[2].replace(/<[^>]+>/g, "").trim(),
    });
  }

  const snippets: string[] = [];
  while ((match = snippetPattern.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
  }

  const urls: string[] = [];
  while ((match = urlPattern.exec(html)) !== null) {
    urls.push(match[1]);
  }

  for (let i = 0; i < links.length && results.length < maxResults; i++) {
    const href = urls[i] || links[i].rawHref || "";
    if (href.includes("ad_provider") || href.includes("duckduckgo.com/y.js")) continue;

    const uddg = href.match(/uddg=([^&]+)/);
    const finalUrl = uddg ? decodeURIComponent(uddg[1]) : href;
    const cleanUrl = finalUrl.startsWith("http") ? finalUrl : `https://${finalUrl}`;

    if (cleanUrl.includes("duckduckgo.com")) continue;

    results.push({
      title: links[i].title,
      url: cleanUrl,
      snippet: snippets[i] || "",
    });
  }

  return results;
}

export const webSearchTool: Tool = {
  name: "WebSearch",
  description:
    "Search the web using DuckDuckGo. Returns titles, URLs, and snippets for the top results.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
      max_results: {
        type: "number",
        description: "Maximum number of results (default 8)",
      },
    },
    required: ["query"],
  },

  async execute(
    input: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    const query = input.query as string;
    const maxResults = (input.max_results as number) || 8;

    try {
      let results = await searchDDGHTML(query, maxResults);

      if (results.length === 0) {
        results = await searchDDGLite(query, maxResults);
      }

      if (results.length === 0) {
        return { output: `No results found for "${query}". Try rephrasing the search.` };
      }

      const formatted = results
        .map(
          (r, i) =>
            `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
        )
        .join("\n\n");

      return { output: `Search results for "${query}":\n\n${formatted}` };
    } catch (err: any) {
      return { output: "", error: `Search failed: ${err.message}` };
    }
  },
};
