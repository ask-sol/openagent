import chalk from "chalk";

export function renderMarkdown(text: string): string {
  let result = text;

  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    const lines = code.trimEnd().split("\n");
    const formatted = lines.map((l: string) => `  ${chalk.gray("│")} ${chalk.white(l)}`).join("\n");
    return `\n${chalk.gray("  ┌─")}\n${formatted}\n${chalk.gray("  └─")}\n`;
  });

  result = result.replace(/`([^`]+)`/g, (_match, code) => {
    return chalk.cyan(code);
  });

  result = result.replace(/\*\*\*([^*]+)\*\*\*/g, (_match, text) => {
    return chalk.bold.italic(text);
  });

  result = result.replace(/\*\*([^*]+)\*\*/g, (_match, text) => {
    return chalk.bold(text);
  });

  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_match, text) => {
    return chalk.italic(text);
  });

  result = result.replace(/~~([^~]+)~~/g, (_match, text) => {
    return chalk.strikethrough(text);
  });

  result = result.replace(/^#{1,6}\s+(.+)$/gm, (_match, text) => {
    return chalk.bold(text);
  });

  result = result.replace(/^(\s*)[-*]\s+/gm, (_match, indent) => {
    return `${indent}${chalk.gray("•")} `;
  });

  result = result.replace(/^(\s*)\d+\.\s+/gm, (_match, indent) => {
    return `${indent}${chalk.gray("›")} `;
  });

  result = result.replace(/^>\s+(.+)$/gm, (_match, text) => {
    return `${chalk.gray("  │")} ${chalk.italic(text)}`;
  });

  result = result.replace(/^---+$/gm, () => {
    return chalk.gray("─".repeat(40));
  });

  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
    return `${chalk.cyan.underline(text)} ${chalk.gray(`(${url})`)}`;
  });

  return result;
}
