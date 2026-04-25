import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import {
  CATALOG,
  isInstalled,
  installServer,
  uninstallServer,
  type CatalogEntry,
} from "../mcp/catalog.js";

interface McpStoreProps {
  onClose: () => void;
}

type Step = "list" | "details" | "env" | "done";

export function McpStore({ onClose }: McpStoreProps) {
  const [step, setStep] = useState<Step>("list");
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [envIdx, setEnvIdx] = useState(0);
  const [envInput, setEnvInput] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useInput((_, key) => {
    if (!key.escape) return;
    if (step === "list") onClose();
    else if (step === "env") setStep("details");
    else if (step === "details") setStep("list");
    else if (step === "done") setStep("list");
  });

  const items = useMemo(() => {
    return CATALOG.map((entry) => {
      const installed = isInstalled(entry.id);
      const tag = installed ? " ✓" : "";
      return {
        label: `${entry.name.padEnd(16)} ${entry.description}${tag}`,
        value: entry.id,
      };
    });
    // refreshKey forces recompute after install/uninstall
  }, [refreshKey]);

  if (step === "list") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">MCP Server Store</Text>
        <Text dimColor>Add Model Context Protocol servers to extend the agent.</Text>
        <Text> </Text>
        <SelectInput
          items={items}
          onSelect={(item) => {
            const entry = CATALOG.find((e) => e.id === item.value)!;
            setSelected(entry);
            setEnvValues({});
            setEnvIdx(0);
            setEnvInput("");
            setStep("details");
          }}
          limit={10}
        />
        <Text> </Text>
        <Text dimColor>↑↓ navigate • enter to view • esc to close • ✓ = installed</Text>
        {statusMsg && <Text color="green">{statusMsg}</Text>}
      </Box>
    );
  }

  if (step === "details" && selected) {
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
              setStep("list");
              return;
            }
            if (item.value === "uninstall") {
              uninstallServer(selected.id);
              setStatusMsg(`Removed ${selected.name}.`);
              setRefreshKey((k) => k + 1);
              setStep("list");
              return;
            }
            if (selected.envVars && selected.envVars.length > 0) {
              setStep("env");
            } else {
              installServer(selected);
              setStatusMsg(`Installed ${selected.name}. Restart OpenAgent to load it.`);
              setRefreshKey((k) => k + 1);
              setStep("list");
            }
          }}
        />
      </Box>
    );
  }

  if (step === "env" && selected && selected.envVars) {
    const current = selected.envVars[envIdx];
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{selected.name} — {current.name}</Text>
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
                setStep("list");
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

  return null;
}
