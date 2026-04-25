import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  CATALOG,
  isInstalled,
  installServer,
  uninstallServer,
  getInstalledServerIds,
  type CatalogEntry,
} from "../mcp/catalog.js";
import {
  getMcpConnectionStatus,
  loadMcpConfig,
  type McpServerConfig,
} from "../mcp/client.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";

interface McpStoreProps {
  onClose: () => void;
}

type Tab = "store" | "installed" | "custom";
type Step =
  | "tabs"
  | "store-list"
  | "store-details"
  | "store-env"
  | "installed-list"
  | "custom-name"
  | "custom-command"
  | "custom-args"
  | "custom-env";

const CONFIG_PATH = join(homedir(), ".openagent", "mcp_servers.json");
const CONFIG_DIR = join(homedir(), ".openagent");

function readRawConfig(): { mcpServers: Record<string, McpServerConfig> } {
  if (!existsSync(CONFIG_PATH)) return { mcpServers: {} };
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return { mcpServers: parsed.mcpServers || parsed || {} };
  } catch {
    return { mcpServers: {} };
  }
}

function writeRawConfig(cfg: { mcpServers: Record<string, McpServerConfig> }) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

export function McpStore({ onClose }: McpStoreProps) {
  const [tab, setTab] = useState<Tab>("store");
  const [step, setStep] = useState<Step>("tabs");
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [envIdx, setEnvIdx] = useState(0);
  const [envInput, setEnvInput] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Custom-server form state
  const [customName, setCustomName] = useState("");
  const [customCommand, setCustomCommand] = useState("");
  const [customArgs, setCustomArgs] = useState("");
  const [customEnvText, setCustomEnvText] = useState("");

  useInput((_, key) => {
    if (!key.escape) return;
    if (step === "tabs") onClose();
    else if (step === "store-list" || step === "installed-list") setStep("tabs");
    else if (step === "store-details") setStep("store-list");
    else if (step === "store-env") setStep("store-details");
    else if (step === "custom-name") setStep("tabs");
    else if (step === "custom-command") setStep("custom-name");
    else if (step === "custom-args") setStep("custom-command");
    else if (step === "custom-env") setStep("custom-args");
  });

  // ─── Tab picker ──────────────────────────────────────────────────────────
  if (step === "tabs") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">MCP Servers</Text>
        <Text dimColor>Connect external tools to OpenAgent.</Text>
        <Text> </Text>
        <SelectInput
          items={[
            { label: "Store        Browse curated MCP servers and install them", value: "store" },
            { label: "Installed    See what's currently configured", value: "installed" },
            { label: "Custom       Add a server that's not in the catalog", value: "custom" },
          ]}
          onSelect={(item) => {
            const v = item.value as Tab;
            setTab(v);
            if (v === "store") setStep("store-list");
            else if (v === "installed") setStep("installed-list");
            else {
              setCustomName("");
              setCustomCommand("");
              setCustomArgs("");
              setCustomEnvText("");
              setStep("custom-name");
            }
          }}
        />
        <Text> </Text>
        <Text dimColor>Config file: <Text color="cyan">~/.openagent/mcp_servers.json</Text></Text>
        <Text dimColor>Esc to close.</Text>
        {statusMsg && <Text color="green">{statusMsg}</Text>}
      </Box>
    );
  }

  // ─── Store: catalog list ─────────────────────────────────────────────────
  if (step === "store-list") {
    const items = CATALOG.map((entry) => {
      const installed = isInstalled(entry.id);
      return {
        label: `${entry.name.padEnd(16)} ${entry.description}${installed ? "  ✓" : ""}`,
        value: entry.id,
      };
    });
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Store · MCP Catalog</Text>
        <Text dimColor>Curated servers that install with one click.</Text>
        <Text> </Text>
        <SelectInput
          items={items}
          onSelect={(item) => {
            const entry = CATALOG.find((e) => e.id === item.value)!;
            setSelected(entry);
            setEnvValues({});
            setEnvIdx(0);
            setEnvInput("");
            setStep("store-details");
          }}
          limit={10}
        />
        <Text> </Text>
        <Text dimColor>↑↓ navigate · enter to view · esc to back · ✓ = installed</Text>
        {statusMsg && <Text color="green">{statusMsg}</Text>}
      </Box>
    );
  }

  // ─── Store: details for one entry ───────────────────────────────────────
  if (step === "store-details" && selected) {
    const installed = isInstalled(selected.id);
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{selected.name}</Text>
        <Text>{selected.description}</Text>
        <Text> </Text>
        <Text dimColor>Category: {selected.category}</Text>
        <Text dimColor>Command: <Text color="cyan">{selected.config.command} {(selected.config.args || []).join(" ")}</Text></Text>
        {selected.notes && (
          <>
            <Text> </Text>
            <Text color="yellow">{selected.notes}</Text>
          </>
        )}
        {selected.envVars && selected.envVars.length > 0 && (
          <>
            <Text> </Text>
            <Text dimColor>Required env vars:</Text>
            {selected.envVars.map((v) => (
              <Text key={v.name} dimColor>  • {v.name} — {v.description}</Text>
            ))}
          </>
        )}
        <Text> </Text>
        <SelectInput
          items={[
            installed
              ? { label: "Remove from config", value: "uninstall" }
              : { label: "Install", value: "install" },
            { label: "Back", value: "back" },
          ]}
          onSelect={(item) => {
            if (item.value === "back") {
              setStep("store-list");
              return;
            }
            if (item.value === "uninstall") {
              uninstallServer(selected.id);
              setStatusMsg(`Removed ${selected.name}.`);
              setRefreshKey((k) => k + 1);
              setStep("store-list");
              return;
            }
            if (selected.envVars && selected.envVars.length > 0) {
              setStep("store-env");
            } else {
              installServer(selected);
              setStatusMsg(`Installed ${selected.name}. Restart OpenAgent to load it.`);
              setRefreshKey((k) => k + 1);
              setStep("store-list");
            }
          }}
        />
      </Box>
    );
  }

  // ─── Store: env-var entry (multi-step form) ──────────────────────────────
  if (step === "store-env" && selected && selected.envVars) {
    const current = selected.envVars[envIdx];
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{selected.name} · {current.name}</Text>
        <Text dimColor>{current.description}</Text>
        <Text dimColor>Step {envIdx + 1} of {selected.envVars.length}</Text>
        <Text> </Text>
        <Box>
          <Text color="cyan">{"❯ "}</Text>
          <TextInput
            value={envInput}
            onChange={setEnvInput}
            onSubmit={() => {
              const val = envInput.trim();
              if (!val && current.required) return;
              const updated = { ...envValues, [current.name]: val };
              setEnvValues(updated);
              setEnvInput("");
              if (envIdx + 1 < selected.envVars!.length) {
                setEnvIdx(envIdx + 1);
              } else {
                installServer(selected, updated);
                setStatusMsg(`Installed ${selected.name}. Restart OpenAgent to load it.`);
                setRefreshKey((k) => k + 1);
                setStep("store-list");
              }
            }}
            mask={current.name.includes("TOKEN") || current.name.includes("KEY") || current.name.includes("PAT") ? "*" : undefined}
          />
        </Box>
        <Text> </Text>
        <Text dimColor>Esc to go back.</Text>
      </Box>
    );
  }

  // ─── Installed list ──────────────────────────────────────────────────────
  if (step === "installed-list") {
    const config = readRawConfig();
    const status = getMcpConnectionStatus();
    const ids = Object.keys(config.mcpServers);
    if (ids.length === 0) {
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Text bold color="cyan">Installed MCP Servers</Text>
          <Text> </Text>
          <Text dimColor>No servers installed yet. Open the Store or add a Custom one.</Text>
          <Text> </Text>
          <Text dimColor>Config: <Text color="cyan">~/.openagent/mcp_servers.json</Text></Text>
          <Text dimColor>Esc to go back.</Text>
        </Box>
      );
    }
    const items = ids.map((id) => {
      const live = status.find((s) => s.name === id);
      const tag = live ? `  ● ${live.toolCount} tools loaded` : "  ○ not connected (restart to load)";
      return { label: `${id.padEnd(20)}${tag}`, value: id };
    });
    items.push({ label: "Back", value: "__back__" });
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Installed MCP Servers</Text>
        <Text dimColor>● = live and connected · ○ = configured but not yet connected</Text>
        <Text> </Text>
        <SelectInput
          items={items}
          onSelect={(item) => {
            if (item.value === "__back__") {
              setStep("tabs");
              return;
            }
            const cfg = readRawConfig();
            delete cfg.mcpServers[item.value];
            writeRawConfig(cfg);
            setStatusMsg(`Removed ${item.value}.`);
            setRefreshKey((k) => k + 1);
          }}
          limit={10}
        />
        <Text> </Text>
        <Text dimColor>Enter to remove · Esc to go back</Text>
        <Text dimColor>Edit directly: <Text color="cyan">~/.openagent/mcp_servers.json</Text></Text>
        {statusMsg && <Text color="green">{statusMsg}</Text>}
      </Box>
    );
  }

  // ─── Custom: name ───────────────────────────────────────────────────────
  if (step === "custom-name") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Add Custom MCP Server</Text>
        <Text dimColor>Step 1 of 4 — pick a short ID for this server.</Text>
        <Text dimColor>Letters, digits, dashes only. Example: my-postgres</Text>
        <Text> </Text>
        <Box>
          <Text color="cyan">{"❯ "}</Text>
          <TextInput
            value={customName}
            onChange={setCustomName}
            onSubmit={() => {
              const v = customName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
              if (!v) return;
              setCustomName(v);
              setStep("custom-command");
            }}
            placeholder="my-server"
          />
        </Box>
        <Text> </Text>
        <Text dimColor>Esc to back.</Text>
      </Box>
    );
  }

  // ─── Custom: command ────────────────────────────────────────────────────
  if (step === "custom-command") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Custom · {customName} · Command</Text>
        <Text dimColor>Step 2 of 4 — the executable to spawn.</Text>
        <Text dimColor>Examples: <Text color="cyan">npx</Text>, <Text color="cyan">uvx</Text>, <Text color="cyan">node</Text>, <Text color="cyan">python3</Text>, <Text color="cyan">/abs/path/to/binary</Text></Text>
        <Text> </Text>
        <Box>
          <Text color="cyan">{"❯ "}</Text>
          <TextInput
            value={customCommand}
            onChange={setCustomCommand}
            onSubmit={() => {
              if (!customCommand.trim()) return;
              setStep("custom-args");
            }}
            placeholder="npx"
          />
        </Box>
        <Text> </Text>
        <Text dimColor>Esc to back.</Text>
      </Box>
    );
  }

  // ─── Custom: args ───────────────────────────────────────────────────────
  if (step === "custom-args") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Custom · {customName} · Arguments</Text>
        <Text dimColor>Step 3 of 4 — space-separated args (optional, can be empty).</Text>
        <Text dimColor>Example: <Text color="cyan">-y @modelcontextprotocol/server-filesystem /Users/me/projects</Text></Text>
        <Text> </Text>
        <Box>
          <Text color="cyan">{"❯ "}</Text>
          <TextInput
            value={customArgs}
            onChange={setCustomArgs}
            onSubmit={() => setStep("custom-env")}
            placeholder="-y @scope/package-name"
          />
        </Box>
        <Text> </Text>
        <Text dimColor>Esc to back.</Text>
      </Box>
    );
  }

  // ─── Custom: env ────────────────────────────────────────────────────────
  if (step === "custom-env") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Custom · {customName} · Environment</Text>
        <Text dimColor>Step 4 of 4 — env vars in KEY=VALUE format, comma-separated. Empty = none.</Text>
        <Text dimColor>Example: <Text color="cyan">API_KEY=sk-..., DEBUG=true</Text></Text>
        <Text> </Text>
        <Box>
          <Text color="cyan">{"❯ "}</Text>
          <TextInput
            value={customEnvText}
            onChange={setCustomEnvText}
            onSubmit={() => {
              const env: Record<string, string> = {};
              for (const pair of customEnvText.split(",")) {
                const eq = pair.indexOf("=");
                if (eq < 0) continue;
                const k = pair.slice(0, eq).trim();
                const v = pair.slice(eq + 1).trim();
                if (k) env[k] = v;
              }
              const args = customArgs
                .trim()
                .split(/\s+/)
                .filter((a) => a.length > 0);
              const cfg = readRawConfig();
              cfg.mcpServers[customName] = {
                command: customCommand.trim(),
                args: args.length > 0 ? args : undefined,
                env: Object.keys(env).length > 0 ? env : undefined,
              };
              writeRawConfig(cfg);
              setStatusMsg(`Added "${customName}". Restart OpenAgent to load it.`);
              setRefreshKey((k) => k + 1);
              setStep("tabs");
            }}
            placeholder=""
          />
        </Box>
        <Text> </Text>
        <Text dimColor>Press Enter with no input to add the server with no env.</Text>
        <Text dimColor>Esc to back.</Text>
      </Box>
    );
  }

  return null;
}
