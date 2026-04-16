import { createServer } from "node:http";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "../config/settings.js";

const BRIDGE_PORT = 8921;
const BRIDGE_FILE = "discord-bridge.json";

export interface DiscordConfig {
  enabled: boolean;
  botToken: string;
  channelId: string;
  allowedUsers?: string[];
}

function getBridgePath(): string {
  return join(getConfigDir(), BRIDGE_FILE);
}

export function loadDiscordConfig(): DiscordConfig | null {
  const path = getBridgePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

export function saveDiscordConfig(config: DiscordConfig): void {
  writeFileSync(getBridgePath(), JSON.stringify(config, null, 2));
}

export type MessageHandler = (from: string, message: string) => Promise<string>;

let pollInterval: ReturnType<typeof setInterval> | null = null;
let lastMessageId = "";

export function startDiscordBridge(onMessage: MessageHandler): { stop: () => void } {
  const config = loadDiscordConfig();
  if (!config) throw new Error("Discord not configured");

  const headers = {
    Authorization: `Bot ${config.botToken}`,
    "Content-Type": "application/json",
  };

  async function pollMessages() {
    try {
      const url = lastMessageId
        ? `https://discord.com/api/v10/channels/${config!.channelId}/messages?after=${lastMessageId}&limit=10`
        : `https://discord.com/api/v10/channels/${config!.channelId}/messages?limit=1`;

      const res = await fetch(url, { headers });
      if (!res.ok) return;

      const messages = (await res.json()) as any[];
      if (!messages.length) return;

      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      for (const msg of messages) {
        if (msg.author.bot) continue;
        if (config!.allowedUsers?.length && !config!.allowedUsers.includes(msg.author.id)) continue;

        lastMessageId = msg.id;

        const content = msg.content;
        if (!content || !content.startsWith("!agent ")) continue;

        const command = content.slice(7).trim();
        if (!command) continue;

        const reply = await onMessage(msg.author.username, command);

        const truncated = reply.length > 1900 ? reply.slice(0, 1900) + "\n..." : reply;
        await fetch(`https://discord.com/api/v10/channels/${config!.channelId}/messages`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            content: truncated,
            message_reference: { message_id: msg.id },
          }),
        });
      }

      if (!lastMessageId && messages.length > 0) {
        lastMessageId = messages[messages.length - 1].id;
      }
    } catch {}
  }

  pollMessages();
  pollInterval = setInterval(pollMessages, 3000);

  return {
    stop: () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    },
  };
}
