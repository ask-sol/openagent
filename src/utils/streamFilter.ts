import { homedir } from "node:os";

const HOME = homedir();

// Internal API/runtime markers that should never reach the user's chat.
// Order matters — most-specific first.
const NOISE_PATTERNS: RegExp[] = [
  // Multi-line / wrapped wrappers
  /<persisted-output>[\s\S]*?<\/persisted-output>/g,
  /<persisted-output>[\s\S]*$/g,
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  /<command-name>[\s\S]*?<\/command-name>/g,
  /<command-message>[\s\S]*?<\/command-message>/g,
  /<command-args>[\s\S]*?<\/command-args>/g,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
  /<command-stdin>[\s\S]*?<\/command-stdin>/g,
  /<\/?ipython-input>/g,

  // Single-line plumbing chatter
  /Output too large \([^)]*\)\. Full output saved to: \S+/g,
  /Command running in background with ID: \w+\. Output is being written to: \S+/g,
  /Monitor started \([^)]*\)\. You will be notified on each event\. Keep working[^.]*\. Events may arrive while[^.]*\./g,
  /Todos have been modified successfully\.[^\n]*/g,
  /Preview \(fi[^\n]*$/gm,
  /^Now the .{0,80}\.\s*$/gm,
];

// Tighten paths — replace home with ~ everywhere
function shortenHome(s: string): string {
  if (!HOME) return s;
  // Escape regex specials in HOME
  const escaped = HOME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return s.replace(new RegExp(escaped, "g"), "~");
}

// Compress long anonymized cache paths like /Users/x/.claude/projects/<uuid>/...
function compressCachePaths(s: string): string {
  return s.replace(
    /(~\/\.claude\/projects)\/[^/\s]+\/([^/\s]+)/g,
    "$1/.../$2",
  );
}

export function filterStreamText(input: string): string {
  let s = input;
  for (const re of NOISE_PATTERNS) s = s.replace(re, "");
  s = shortenHome(s);
  s = compressCachePaths(s);
  // Collapse runs of 3+ blank lines to 2
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}

export function shortPath(p: string): string {
  if (!p) return "";
  return compressCachePaths(shortenHome(p));
}
