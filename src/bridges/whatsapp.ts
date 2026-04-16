import { createServer } from "node:http";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "../config/settings.js";

const BRIDGE_PORT = 8920;
const BRIDGE_FILE = "whatsapp-bridge.json";

export interface WhatsAppConfig {
  enabled: boolean;
  webhookUrl?: string;
  phoneNumber?: string;
  verifyToken: string;
}

function getBridgePath(): string {
  return join(getConfigDir(), BRIDGE_FILE);
}

export function loadWhatsAppConfig(): WhatsAppConfig | null {
  const path = getBridgePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

export function saveWhatsAppConfig(config: WhatsAppConfig): void {
  writeFileSync(getBridgePath(), JSON.stringify(config, null, 2));
}

export type MessageHandler = (from: string, message: string) => Promise<string>;

export function startWhatsAppBridge(onMessage: MessageHandler): { port: number; stop: () => void } {
  const config = loadWhatsAppConfig();
  const verifyToken = config?.verifyToken || Math.random().toString(36).slice(2);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${BRIDGE_PORT}`);

    if (req.method === "GET" && url.pathname === "/webhook") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === verifyToken) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(challenge);
      } else {
        res.writeHead(403);
        res.end("Forbidden");
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/webhook") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);

          const entries = data.entry || [];
          for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
              const messages = change.value?.messages || [];
              for (const msg of messages) {
                if (msg.type === "text" && msg.text?.body) {
                  const from = msg.from || "unknown";
                  const reply = await onMessage(from, msg.text.body);

                  if (config?.phoneNumber && config?.webhookUrl) {
                    await sendWhatsAppReply(config, from, reply);
                  }
                }
              }
            }
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok" }));
        } catch {
          res.writeHead(400);
          res.end("Bad request");
        }
      });
      return;
    }

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "running", bridge: "whatsapp" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/send") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const { message } = JSON.parse(body);
          const reply = await onMessage("local", message);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ reply }));
        } catch {
          res.writeHead(400);
          res.end("Bad request");
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(BRIDGE_PORT);

  return {
    port: BRIDGE_PORT,
    stop: () => server.close(),
  };
}

async function sendWhatsAppReply(config: WhatsAppConfig, to: string, text: string): Promise<void> {
  if (!config.webhookUrl) return;

  try {
    await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
  } catch {}
}
