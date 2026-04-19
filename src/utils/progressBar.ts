const FULL = "█";
const PARTIALS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];
const EMPTY = "░";

const C_RESET = "\x1b[0m";
const C_DIM = "\x1b[2m";
const C_CYAN = "\x1b[36m";
const C_GREEN = "\x1b[32m";
const C_YELLOW = "\x1b[33m";
const C_GRAY = "\x1b[90m";
const C_BOLD = "\x1b[1m";

export function renderBar(percent: number, width: number): string {
  const pct = Math.max(0, Math.min(100, percent));
  const scaled = (pct / 100) * width;
  const fullCount = Math.floor(scaled);
  const partialIdx = Math.round((scaled - fullCount) * PARTIALS.length);
  const fullChars = FULL.repeat(fullCount);
  const partialChar = partialIdx > 0 && fullCount < width ? PARTIALS[partialIdx] : "";
  const emptyCount = Math.max(0, width - fullCount - (partialChar ? 1 : 0));
  const emptyChars = EMPTY.repeat(emptyCount);
  const color = pct >= 95 ? C_GREEN : pct >= 50 ? C_CYAN : C_YELLOW;
  return `${color}${fullChars}${partialChar}${emptyChars}${C_RESET}`;
}

export interface ProgressState {
  percent: number;
  phase: string;
  detail: string;
}

export class LiveProgress {
  private lastLines = 0;
  private spinnerIdx = 0;
  private spinnerTimer: NodeJS.Timeout | null = null;
  private state: ProgressState = { percent: 0, phase: "Starting", detail: "" };
  private readonly spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private readonly width: number;
  private readonly title: string;

  constructor(title: string, width = 40) {
    this.title = title;
    this.width = width;
  }

  start(): void {
    process.stdout.write("\x1b[?25l");
    this.render();
    this.spinnerTimer = setInterval(() => {
      this.spinnerIdx = (this.spinnerIdx + 1) % this.spinnerFrames.length;
      this.render();
    }, 80);
  }

  update(patch: Partial<ProgressState>): void {
    this.state = { ...this.state, ...patch };
    this.render();
  }

  finish(message: string, ok: boolean = true): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }
    this.state.percent = 100;
    this.clear();
    const icon = ok ? `${C_GREEN}✓${C_RESET}` : `${C_YELLOW}✗${C_RESET}`;
    const bar = renderBar(100, this.width);
    process.stdout.write(`  ${bar} ${C_BOLD}100%${C_RESET}\n`);
    process.stdout.write(`  ${icon} ${message}\n\n`);
    process.stdout.write("\x1b[?25h");
  }

  fail(message: string): void {
    this.finish(message, false);
  }

  private clear(): void {
    for (let i = 0; i < this.lastLines; i++) {
      process.stdout.write("\x1b[1A\x1b[2K");
    }
    this.lastLines = 0;
  }

  private render(): void {
    this.clear();
    const bar = renderBar(this.state.percent, this.width);
    const pctStr = `${Math.round(this.state.percent)}%`.padStart(4);
    const spinner = this.spinnerFrames[this.spinnerIdx];
    const lines: string[] = [];
    lines.push(`  ${C_BOLD}${this.title}${C_RESET}`);
    lines.push("");
    lines.push(`  ${bar} ${C_BOLD}${pctStr}${C_RESET}`);
    lines.push(`  ${C_CYAN}${spinner}${C_RESET} ${this.state.phase}${this.state.detail ? `${C_GRAY} — ${this.state.detail}${C_RESET}` : ""}`);
    process.stdout.write(lines.join("\n") + "\n");
    this.lastLines = lines.length;
  }
}

export interface BrewPhase {
  percent: number;
  phase: string;
  detail: string;
}

interface PhaseWeight {
  label: string;
  startPct: number;
  endPct: number;
}

const BREW_PHASES: Record<string, PhaseWeight> = {
  fetching: { label: "Fetching", startPct: 0, endPct: 15 },
  downloading: { label: "Downloading", startPct: 15, endPct: 60 },
  verifying: { label: "Verifying checksum", startPct: 60, endPct: 63 },
  installing: { label: "Installing", startPct: 63, endPct: 85 },
  pouring: { label: "Pouring bottle", startPct: 63, endPct: 85 },
  caveats: { label: "Running caveats", startPct: 85, endPct: 92 },
  summary: { label: "Finalizing", startPct: 92, endPct: 100 },
};

export class BrewParser {
  private current: PhaseWeight = BREW_PHASES.fetching;
  private lastPercent = 0;
  private lastDetail = "";

  feed(chunk: string): BrewPhase {
    const cleaned = chunk.replace(/\r/g, "\n");
    const lines = cleaned.split("\n");

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const header = line.match(/^==>\s+(.+)$/);
      if (header) {
        const text = header[1].toLowerCase();
        if (text.startsWith("fetching")) this.current = BREW_PHASES.fetching;
        else if (text.startsWith("downloading")) this.current = BREW_PHASES.downloading;
        else if (text.startsWith("verifying")) this.current = BREW_PHASES.verifying;
        else if (text.startsWith("pouring")) this.current = BREW_PHASES.pouring;
        else if (text.startsWith("installing")) this.current = BREW_PHASES.installing;
        else if (text.startsWith("caveats")) this.current = BREW_PHASES.caveats;
        else if (text.startsWith("summary")) this.current = BREW_PHASES.summary;
        this.lastDetail = header[1];
        this.lastPercent = this.current.startPct;
        continue;
      }

      const pct = line.match(/(\d+(?:\.\d+)?)%/);
      if (pct) {
        const innerPct = parseFloat(pct[1]);
        const span = this.current.endPct - this.current.startPct;
        this.lastPercent = this.current.startPct + (innerPct / 100) * span;
      } else if (line.includes("🍺") || /\bPoured from/i.test(line)) {
        this.lastPercent = 100;
        this.current = BREW_PHASES.summary;
      } else if (line.length < 120 && !line.startsWith("#") && !line.startsWith("curl:")) {
        this.lastDetail = line.slice(0, 80);
      }
    }

    return {
      percent: Math.min(99, this.lastPercent),
      phase: this.current.label,
      detail: this.lastDetail,
    };
  }
}

export function parsePullPercent(line: string): number | null {
  const m = line.match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) return parseFloat(m[1]);
  const downloaded = line.match(/(\d+(?:\.\d+)?)\s*(\w+B)\s*\/\s*(\d+(?:\.\d+)?)\s*(\w+B)/);
  if (downloaded) {
    const units: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
    const a = parseFloat(downloaded[1]) * (units[downloaded[2].toUpperCase()] || 1);
    const b = parseFloat(downloaded[3]) * (units[downloaded[4].toUpperCase()] || 1);
    if (b > 0) return (a / b) * 100;
  }
  return null;
}
