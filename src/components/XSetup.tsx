import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { loadSettings, saveSettings } from "../config/settings.js";

type Step = "info" | "api_key" | "api_secret" | "access_token" | "access_secret" | "done";

interface XSetupProps {
  onComplete: (msg: string) => void;
  onCancel: () => void;
}

export function XSetup({ onComplete, onCancel }: XSetupProps) {
  const [step, setStep] = useState<Step>("info");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [accessSecret, setAccessSecret] = useState("");
  const [error, setError] = useState("");

  useInput((_, key) => {
    if (!key.escape) return;
    setError("");
    switch (step) {
      case "info": onCancel(); return;
      case "api_key": setStep("info"); return;
      case "api_secret": setStep("api_key"); return;
      case "access_token": setStep("api_secret"); return;
      case "access_secret": setStep("access_token"); return;
    }
  });

  const handleInfoDone = () => setStep("api_key");

  const handleApiKey = (val: string) => {
    if (!val.trim()) { setError("Required"); return; }
    setError("");
    setApiKey(val.trim());
    setStep("api_secret");
  };

  const handleApiSecret = (val: string) => {
    if (!val.trim()) { setError("Required"); return; }
    setError("");
    setApiSecret(val.trim());
    setStep("access_token");
  };

  const handleAccessToken = (val: string) => {
    if (!val.trim()) { setError("Required"); return; }
    setError("");
    setAccessToken(val.trim());
    setStep("access_secret");
  };

  const handleAccessSecret = (val: string) => {
    if (!val.trim()) { setError("Required"); return; }
    setError("");

    const settings = loadSettings();
    settings.x = {
      apiKey,
      apiSecret,
      accessToken,
      accessSecret: val.trim(),
    };
    saveSettings(settings);
    setStep("done");
    onComplete("X (Twitter) connected.");
  };

  if (step === "info") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">X (Twitter) Setup</Text>
        <Text> </Text>
        <Text>1. Go to: <Text color="cyan">https://developer.x.com/en/portal/dashboard</Text></Text>
        <Text>2. Create a project & app (or use existing)</Text>
        <Text>3. Go to "Keys and tokens"</Text>
        <Text>4. Get: API Key, API Secret, Access Token, Access Token Secret</Text>
        <Text>5. Make sure app has "Read and Write" permissions</Text>
        <Text> </Text>
        <Text dimColor>Press Enter to continue</Text>
        <TextInput value="" onChange={() => {}} onSubmit={handleInfoDone} />
      </Box>
    );
  }

  if (step === "api_key") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">X — API Key (Consumer Key)</Text>
        {error && <Text color="red">{error}</Text>}
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={apiKey} onChange={setApiKey} onSubmit={handleApiKey} /></Box>
      </Box>
    );
  }

  if (step === "api_secret") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">X — API Secret (Consumer Secret)</Text>
        {error && <Text color="red">{error}</Text>}
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={apiSecret} onChange={setApiSecret} onSubmit={handleApiSecret} mask="*" /></Box>
      </Box>
    );
  }

  if (step === "access_token") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">X — Access Token</Text>
        {error && <Text color="red">{error}</Text>}
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={accessToken} onChange={setAccessToken} onSubmit={handleAccessToken} /></Box>
      </Box>
    );
  }

  if (step === "access_secret") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">X — Access Token Secret</Text>
        {error && <Text color="red">{error}</Text>}
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={accessSecret} onChange={setAccessSecret} onSubmit={handleAccessSecret} mask="*" /></Box>
      </Box>
    );
  }

  return null;
}
