import chalk from "chalk";

export function renderMarkdown(text: string): string {
  let result = text;

  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    const lines = code.trimEnd().split("\n");
    const formatted = lines.map((l: string) => `  ${chalk.gray("│")} ${l}`).join("\n");
    return `\n${chalk.gray("  ┌─")}\n${formatted}\n${chalk.gray("  └─")}\n`;
  });

  result = result.replace(/`([^`]+)`/g, (_match, code) => {
    return chalk.white(code);
  });

  result = result.replace(/\*\*\*([^*]+)\*\*\*/g, (_match, t) => chalk.bold.italic(t));
  result = result.replace(/\*\*([^*]+)\*\*/g, (_match, t) => chalk.bold(t));
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_match, t) => chalk.italic(t));
  result = result.replace(/~~([^~]+)~~/g, (_match, t) => chalk.strikethrough(t));

  result = result.replace(/^#{1,6}\s+(.+)$/gm, (_match, t) => chalk.bold(t));

  result = result.replace(/^(\s*)[-*•]\s+/gm, (_match, indent) => `${indent}- `);

  result = result.replace(/^>\s+(.+)$/gm, (_match, t) => chalk.gray(`  | ${t}`));

  result = result.replace(/^---+$/gm, () => chalk.gray("─".repeat(30)));

  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, t, url) => `${t} (${chalk.gray(url)})`);

  result = result.replace(/\{\{think\}\}([\s\S]*?)\{\{\/think\}\}/g, (_match, thought) => {
    return chalk.dim.gray(thought);
  });

  return result;
}
