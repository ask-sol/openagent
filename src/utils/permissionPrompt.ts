import { createInterface } from "node:readline";

export function promptPermission(toolName: string, description: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    process.stderr.write(`\n  \x1b[33m?\x1b[0m \x1b[1m${toolName}\x1b[0m — ${description}\n`);
    process.stderr.write(`  \x1b[90mAllow?\x1b[0m (\x1b[32my\x1b[0m/\x1b[31mn\x1b[0m/\x1b[36ma\x1b[0m=always) `);

    const onData = (data: Buffer) => {
      const ch = data.toString().trim().toLowerCase();
      if (ch === "y" || ch === "yes" || ch === "") {
        process.stdin.removeListener("data", onData);
        process.stdin.setRawMode?.(false);
        process.stderr.write("\x1b[32m✓ Allowed\x1b[0m\n\n");
        resolve(true);
      } else if (ch === "n" || ch === "no") {
        process.stdin.removeListener("data", onData);
        process.stdin.setRawMode?.(false);
        process.stderr.write("\x1b[31m✗ Denied\x1b[0m\n\n");
        resolve(false);
      } else if (ch === "a" || ch === "always") {
        process.stdin.removeListener("data", onData);
        process.stdin.setRawMode?.(false);
        process.stderr.write("\x1b[36m✓ Always allowed\x1b[0m\n\n");
        const { addRule } = require("../config/permissions.js");
        addRule({ tool: toolName, behavior: "allow" }, "global");
        resolve(true);
      }
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode?.(true);
    }
    process.stdin.on("data", onData);
  });
}
