import { highlight } from "cli-highlight";

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  py: "python", rb: "ruby", rs: "rust", go: "go", java: "java",
  kt: "kotlin", swift: "swift", c: "c", cpp: "cpp", h: "c", hpp: "cpp",
  cs: "csharp", php: "php", sh: "bash", bash: "bash", zsh: "bash",
  html: "html", css: "css", scss: "scss", less: "less",
  json: "json", yaml: "yaml", yml: "yaml", toml: "ini",
  md: "markdown", sql: "sql", graphql: "graphql",
  dockerfile: "dockerfile", makefile: "makefile",
  xml: "xml", svg: "xml",
};

export function detectLang(filePath: string): string | undefined {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const base = filePath.split("/").pop()?.toLowerCase() || "";

  if (base === "dockerfile") return "dockerfile";
  if (base === "makefile") return "makefile";
  if (base.endsWith(".env")) return "bash";

  return EXT_TO_LANG[ext];
}

export function highlightCode(code: string, filePath: string): string {
  const lang = detectLang(filePath);
  if (!lang) return code;

  try {
    return highlight(code, { language: lang, ignoreIllegals: true });
  } catch {
    return code;
  }
}

export function highlightLine(line: string, filePath: string): string {
  const lang = detectLang(filePath);
  if (!lang) return line;

  try {
    return highlight(line, { language: lang, ignoreIllegals: true }).replace(/\n$/, "");
  } catch {
    return line;
  }
}
