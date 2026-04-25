import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import {
  BUILTIN_PLUGINS,
  isPluginEnabled,
  enablePlugin,
  disablePlugin,
  type Plugin,
} from "../plugins/index.js";

interface PluginStoreProps {
  onClose: () => void;
}

type Step = "list" | "details";

const CATEGORY_LABEL: Record<Plugin["category"], string> = {
  "code-quality": "Quality",
  "debugging": "Debug",
  "git": "Git",
  "safety": "Safety",
  "config": "Config",
};

export function PluginStore({ onClose }: PluginStoreProps) {
  const [step, setStep] = useState<Step>("list");
  const [selected, setSelected] = useState<Plugin | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");

  useInput((_, key) => {
    if (!key.escape) return;
    if (step === "list") onClose();
    else setStep("list");
  });

  if (step === "list") {
    const items = BUILTIN_PLUGINS.map((p) => {
      const on = isPluginEnabled(p.id);
      const dot = on ? "●" : "○";
      return {
        label: `${dot} ${p.name.padEnd(22)} [${CATEGORY_LABEL[p.category]}]  ${p.description}`,
        value: p.id,
      };
    });
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Plugin Store</Text>
        <Text dimColor>Toggle bundled plugins that extend the agent with new tools.</Text>
        <Text> </Text>
        <SelectInput
          items={items}
          onSelect={(item) => {
            const p = BUILTIN_PLUGINS.find((x) => x.id === item.value)!;
            setSelected(p);
            setStep("details");
          }}
          limit={12}
        />
        <Text> </Text>
        <Text dimColor>↑↓ navigate • enter to view • esc to close • ● = enabled</Text>
        {statusMsg && <Text color="green">{statusMsg}</Text>}
      </Box>
    );
  }

  if (step === "details" && selected) {
    const enabled = isPluginEnabled(selected.id);
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{selected.name}</Text>
        <Text>{selected.description}</Text>
        <Text> </Text>
        <Text dimColor>Category: {CATEGORY_LABEL[selected.category]}</Text>
        <Text dimColor>Adds tools:</Text>
        {selected.tools.map((t) => (
          <Text key={t.name} dimColor>  • <Text color="cyan">{t.name}</Text> — {t.description.slice(0, 80)}</Text>
        ))}
        <Text> </Text>
        <SelectInput
          items={[
            enabled
              ? { label: "Disable plugin", value: "off" }
              : { label: "Enable plugin", value: "on" },
            { label: "Back", value: "back" },
          ]}
          onSelect={(item) => {
            if (item.value === "back") {
              setStep("list");
              return;
            }
            if (item.value === "on") {
              enablePlugin(selected.id);
              setStatusMsg(`Enabled ${selected.name}. Restart OpenAgent to register its tools.`);
            } else {
              disablePlugin(selected.id);
              setStatusMsg(`Disabled ${selected.name}.`);
            }
            setRefreshKey((k) => k + 1);
            setStep("list");
          }}
        />
        <Text> </Text>
        <Text dimColor>Esc to go back.</Text>
      </Box>
    );
  }

  return null;
}
