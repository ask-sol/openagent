import chalk from "chalk";

const METER_CHARS = ["○", "◔", "◑", "◕", "●"];

export function getContextMeter(usedTokens: number, maxContext: number): string {
  if (maxContext <= 0) return chalk.gray("○");

  const ratio = Math.min(usedTokens / maxContext, 1);
  const pct = Math.round(ratio * 100);

  let color: typeof chalk;
  if (ratio < 0.5) color = chalk.blue;
  else if (ratio < 0.75) color = chalk.yellow;
  else if (ratio < 0.9) color = chalk.red;
  else color = chalk.bgRed.white;

  const idx = Math.min(Math.floor(ratio * (METER_CHARS.length - 1)), METER_CHARS.length - 1);
  const char = METER_CHARS[idx];

  return color(`${char} ${pct}%`);
}

export function getContextBar(usedTokens: number, maxContext: number, width = 10): string {
  if (maxContext <= 0) return chalk.gray("░".repeat(width));

  const ratio = Math.min(usedTokens / maxContext, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  let color: typeof chalk;
  if (ratio < 0.5) color = chalk.blue;
  else if (ratio < 0.75) color = chalk.yellow;
  else if (ratio < 0.9) color = chalk.red;
  else color = chalk.bgRed.white;

  return color("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}
