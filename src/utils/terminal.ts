import chalk from "chalk";

export const BANNER = chalk.cyan(`
   ____                   ___                    __
  / __ \\____  ___  ____  /   | ____ ____  ____  / /_
 / / / / __ \\/ _ \\/ __ \\/  /| |/ __ \`/ _ \\/ __ \\/ __/
/ /_/ / /_/ /  __/ / / / ___ / /_/ /  __/ / / / /_
\\____/ .___/\\___/_/ /_/_/  |_\\__, /\\___/_/ /_/\\__/
    /_/                     /____/
`);

export const BANNER_COMPACT = chalk.cyan(`── OpenAgent ──`);

export function getBanner(width: number): string {
  return width >= 60 ? BANNER : BANNER_COMPACT;
}

export function getTerminalSize(): { columns: number; rows: number } {
  return {
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  };
}

export function onResize(callback: (size: { columns: number; rows: number }) => void): () => void {
  const handler = () => {
    callback(getTerminalSize());
  };
  process.stdout.on("resize", handler);
  return () => {
    process.stdout.off("resize", handler);
  };
}

export function truncateToWidth(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  return text.slice(0, maxWidth - 3) + "...";
}

export function wrapText(text: string, width: number): string {
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    if (line.length <= width) {
      lines.push(line);
    } else {
      let remaining = line;
      while (remaining.length > width) {
        let breakAt = remaining.lastIndexOf(" ", width);
        if (breakAt <= 0) breakAt = width;
        lines.push(remaining.slice(0, breakAt));
        remaining = remaining.slice(breakAt).trimStart();
      }
      if (remaining) lines.push(remaining);
    }
  }
  return lines.join("\n");
}

export function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}
