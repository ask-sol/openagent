import { exec } from "node:child_process";
import { resolve, isAbsolute } from "node:path";
import { readFileSync, statSync } from "node:fs";
import fg from "fast-glob";
import { commandExists, isWindows } from "../../utils/platform.js";
import type { Tool, ToolResult, ToolContext } from "../types.js";

const MAX_RESULTS = 500;
const MAX_BYTES_PER_FILE = 5 * 1024 * 1024;

export const grepTool: Tool = {
  name: "Grep",
  description:
    "Search file contents using regex patterns. Returns matching lines with file paths and line numbers.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Regex pattern to search for",
      },
      path: {
        type: "string",
        description: "File or directory to search in (defaults to cwd)",
      },
      glob: {
        type: "string",
        description: 'File pattern filter (e.g. "*.ts", "*.{js,jsx}")',
      },
      context: {
        type: "number",
        description: "Lines of context around matches",
      },
      case_insensitive: {
        type: "boolean",
        description: "Case insensitive search",
      },
    },
    required: ["pattern"],
  },

  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const pattern = input.pattern as string;
    const searchPath = input.path
      ? isAbsolute(input.path as string)
        ? (input.path as string)
        : resolve(context.cwd, input.path as string)
      : context.cwd;

    const caseInsensitive = !!input.case_insensitive;
    const ctxLines = typeof input.context === "number" ? input.context : 0;
    const globFilter = (input.glob as string) || "";

    if (await commandExists("rg")) {
      return runRipgrep(pattern, searchPath, { caseInsensitive, ctxLines, globFilter, cwd: context.cwd });
    }
    return runNodeGrep(pattern, searchPath, { caseInsensitive, ctxLines, globFilter });
  },
};

interface GrepOpts {
  caseInsensitive: boolean;
  ctxLines: number;
  globFilter: string;
  cwd?: string;
}

function runRipgrep(pattern: string, searchPath: string, opts: GrepOpts): Promise<ToolResult> {
  return new Promise((resolveOut) => {
    const args: string[] = ["-n", "--no-heading", "--color=never"];
    if (opts.caseInsensitive) args.push("-i");
    if (opts.ctxLines) args.push(`-C${opts.ctxLines}`);
    if (opts.globFilter) args.push(`--glob=${opts.globFilter}`);
    args.push("-g", "!node_modules", "-g", "!.git", "-g", "!dist");

    const quote = isWindows() ? quoteWindows : quotePosix;
    const cmd = `rg ${args.join(" ")} ${quote(pattern)} ${quote(searchPath)}`;

    exec(
      cmd,
      {
        cwd: opts.cwd,
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 5,
        windowsHide: true,
        shell: isWindows() ? "powershell.exe" : undefined,
      },
      (_err, stdout) => {
        const lines = stdout.split("\n").filter(Boolean).slice(0, MAX_RESULTS);
        if (lines.length === 0) {
          resolveOut({ output: "No matches found." });
        } else {
          resolveOut({ output: `Found ${lines.length} matching lines:\n${lines.join("\n")}` });
        }
      }
    );
  });
}

async function runNodeGrep(pattern: string, searchPath: string, opts: GrepOpts): Promise<ToolResult> {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, opts.caseInsensitive ? "i" : "");
  } catch (err: any) {
    return { output: `Invalid regex: ${err.message}` };
  }

  let files: string[];
  try {
    const stat = statSync(searchPath);
    if (stat.isFile()) {
      files = [searchPath];
    } else {
      const pat = opts.globFilter ? `**/${opts.globFilter}` : "**/*";
      files = await fg(pat, {
        cwd: searchPath,
        absolute: true,
        ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
        onlyFiles: true,
        dot: false,
        followSymbolicLinks: false,
        suppressErrors: true,
      });
    }
  } catch (err: any) {
    return { output: `Cannot access ${searchPath}: ${err.message}` };
  }

  const out: string[] = [];
  let total = 0;

  for (const file of files) {
    if (total >= MAX_RESULTS) break;
    let content: string;
    try {
      const stat = statSync(file);
      if (stat.size > MAX_BYTES_PER_FILE) continue;
      content = readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    if (content.indexOf("\0") !== -1) continue;

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (total >= MAX_RESULTS) break;
      if (!regex.test(lines[i])) continue;

      if (opts.ctxLines > 0) {
        const start = Math.max(0, i - opts.ctxLines);
        const end = Math.min(lines.length - 1, i + opts.ctxLines);
        for (let j = start; j <= end; j++) {
          out.push(`${file}:${j + 1}:${lines[j]}`);
        }
        out.push("--");
      } else {
        out.push(`${file}:${i + 1}:${lines[i]}`);
      }
      total++;
    }
  }

  if (out.length === 0) return { output: "No matches found." };
  return { output: `Found ${total} matching lines:\n${out.join("\n")}` };
}

function quotePosix(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function quoteWindows(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}
