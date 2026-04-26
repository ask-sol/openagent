import { createServer, type Server } from "node:http";
import { createReadStream, statSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { networkInterfaces } from "node:os";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import QRCode from "qrcode";

export interface ShareSession {
  url: string;
  port: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  qrAscii: string;
  stop: () => void;
  /** Resolves once a successful download completes (one-shot mode). */
  done: Promise<{ downloadedBy: string; at: Date }>;
}

export function getLocalIPv4(): string {
  const interfaces = networkInterfaces();
  // Prefer 192.168.* / 10.* / 172.16-31.* — the user's actual LAN IP
  const candidates: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === "IPv4" && !net.internal) candidates.push(net.address);
    }
  }
  const lan = candidates.find(
    (a) => a.startsWith("192.168.") || a.startsWith("10.") || /^172\.(1[6-9]|2\d|3[01])\./.test(a),
  );
  return lan || candidates[0] || "127.0.0.1";
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function renderQrAscii(text: string): Promise<string> {
  // Build the QR matrix ourselves and render each module as a 2-char-wide
  // block with ANSI background-color escapes. This renders identically in
  // every terminal font (no Unicode half-block alignment issues, no
  // sub-pixel offsets that throw off phone QR scanners).
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size: number = qr.modules.size;
  const data: Uint8Array = qr.modules.data as unknown as Uint8Array;

  const QUIET = 2;
  const DARK = "\x1b[40m  \x1b[0m";   // black background, 2 spaces
  const LIGHT = "\x1b[107m  \x1b[0m"; // bright-white background, 2 spaces

  const lines: string[] = [];
  const totalWidth = size + 2 * QUIET;

  // Top quiet zone
  for (let i = 0; i < QUIET; i++) {
    lines.push(LIGHT.repeat(totalWidth));
  }
  // QR rows with side quiet zones
  for (let y = 0; y < size; y++) {
    let row = LIGHT.repeat(QUIET);
    for (let x = 0; x < size; x++) {
      const bit = data[y * size + x];
      row += bit ? DARK : LIGHT;
    }
    row += LIGHT.repeat(QUIET);
    lines.push(row);
  }
  // Bottom quiet zone
  for (let i = 0; i < QUIET; i++) {
    lines.push(LIGHT.repeat(totalWidth));
  }

  return lines.join("\n");
}

async function findFreePort(start = 8888, max = 8988): Promise<number> {
  for (let port = start; port < max; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const s = createServer();
      s.once("error", () => resolve(false));
      s.listen(port, () => {
        s.close(() => resolve(true));
      });
    });
    if (free) return port;
  }
  throw new Error("No free port in range 8888-8988");
}

/**
 * Open a native file picker on macOS via `osascript`.
 * Returns the absolute file path or null if cancelled.
 */
export async function pickFileMac(): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("osascript", [
      "-e",
      'tell application "System Events" to activate',
      "-e",
      'POSIX path of (choose file with prompt "Select a file to share")',
    ]);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => {
      if (code !== 0 || !out.trim()) {
        resolve(null);
        return;
      }
      resolve(out.trim());
    });
    child.on("error", () => resolve(null));
  });
}

/**
 * Spin up a one-shot HTTP server that serves a single file. The URL has a random
 * token in the path so it's not guessable. Server shuts down on first successful
 * download (or when stop() is called).
 */
export async function startShareSession(filePath: string): Promise<ShareSession> {
  if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const stats = statSync(filePath);
  if (!stats.isFile()) throw new Error(`Not a file: ${filePath}`);

  const fileName = basename(filePath);
  const fileSize = stats.size;
  const token = randomBytes(18).toString("base64url");
  const port = await findFreePort();
  const ip = getLocalIPv4();
  const path = `/${token}/${encodeURIComponent(fileName)}`;
  const url = `http://${ip}:${port}${path}`;

  let resolveDone!: (info: { downloadedBy: string; at: Date }) => void;
  const done = new Promise<{ downloadedBy: string; at: Date }>((res) => {
    resolveDone = res;
  });

  const downloadPath = `${path}?dl=1`;

  const renderLandingPage = (): string => {
    const sizeStr = humanSize(fileSize);
    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${escape(fileName)} · OpenAgent</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{
  background:#0a0a0b;
  color:#e4e4e7;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  display:flex;align-items:center;justify-content:center;
  padding:1.5rem;
}
.card{
  width:100%;max-width:380px;
  text-align:center;
}
.brand{
  font-weight:700;font-size:.95rem;letter-spacing:-.01em;
  color:#fafafa;margin-bottom:2.5rem;
}
.brand-dot{display:inline-block;width:8px;height:8px;background:#22c55e;border-radius:50%;margin-right:.55rem;vertical-align:middle}
.file{
  background:#111114;border:1px solid #1f1f23;border-radius:12px;
  padding:1.25rem;margin-bottom:1rem;
}
.file-name{
  font-size:1.05rem;font-weight:600;color:#fafafa;
  word-break:break-all;line-height:1.35;margin-bottom:.4rem;
}
.file-size{color:#71717a;font-size:.85rem}
.btn{
  display:flex;align-items:center;justify-content:center;
  width:100%;padding:.85rem 1rem;border-radius:10px;
  font-size:.95rem;font-weight:600;letter-spacing:-.005em;
  text-decoration:none;border:1px solid transparent;
  transition:background .12s,border-color .12s;
}
.btn-primary{background:#2563eb;color:#fff;margin-bottom:.6rem}
.btn-primary:active{background:#1d4ed8}
.btn-secondary{background:transparent;color:#a1a1aa;border-color:#27272a}
.btn-secondary:active{background:#18181b}
.icon{width:16px;height:16px;margin-right:.5rem;flex-shrink:0}
.foot{margin-top:1.5rem;color:#52525b;font-size:.75rem}
.foot a{color:#71717a;text-decoration:none}
</style>
</head>
<body>
<div class="card">
  <div class="brand"><span class="brand-dot"></span>OpenAgent</div>
  <div class="file">
    <div class="file-name">${escape(fileName)}</div>
    <div class="file-size">${sizeStr}</div>
  </div>
  <a class="btn btn-primary" href="${downloadPath}" download="${escape(fileName)}">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    Download
  </a>
  <a class="btn btn-secondary" href="https://github.com/ask-sol/openagent" target="_blank" rel="noopener noreferrer">
    <svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.4.5 0 5.9 0 12.5c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2.9-.3 1.9-.4 2.9-.4s2 .1 2.9.4c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6C20.6 22.3 24 17.8 24 12.5 24 5.9 18.6.5 12 .5z"/></svg>
    View on GitHub
  </a>
  <div class="foot">One-shot download. Server stops after you tap.</div>
</div>
</body>
</html>`;
  };

  let server: Server | null = createServer((req, res) => {
    if (req.method !== "GET") {
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }

    const remote = (req.socket.remoteAddress || "unknown").replace(/^::ffff:/, "");

    // Landing page request
    if (req.url === path) {
      const html = renderLandingPage();
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": String(Buffer.byteLength(html, "utf-8")),
        "Cache-Control": "no-store",
      });
      res.end(html);
      return;
    }

    // Actual download
    if (req.url === downloadPath) {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(fileSize),
        "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "\\\"")}"`,
      });
      const stream = createReadStream(filePath);
      stream.pipe(res);
      stream.on("end", () => {
        resolveDone({ downloadedBy: remote, at: new Date() });
        setTimeout(() => {
          if (server) {
            server.close();
            server = null;
          }
        }, 100);
      });
      stream.on("error", () => {
        try {
          res.destroy();
        } catch {}
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  await new Promise<void>((resolve) => server!.listen(port, "0.0.0.0", () => resolve()));

  const qrAscii = await renderQrAscii(url);

  return {
    url,
    port,
    filePath,
    fileName,
    fileSize,
    qrAscii,
    stop: () => {
      if (server) {
        server.close();
        server = null;
      }
    },
    done,
  };
}

export function formatShareSummary(s: ShareSession): string {
  const lines: string[] = [];
  lines.push(s.qrAscii.replace(/\n+$/, ""));
  lines.push("");
  lines.push(`  File: ${s.fileName} (${humanSize(s.fileSize)})`);
  lines.push(`  URL:  ${s.url}`);
  lines.push(`  Port: ${s.port}`);
  lines.push("");
  lines.push("  Scan the QR or open the URL on the same Wi-Fi network.");
  lines.push("  Server stops after one download. Esc / Ctrl+C to cancel.");
  return lines.join("\n");
}
