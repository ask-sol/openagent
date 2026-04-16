import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { loadSettings, saveSettings } from "../config/settings.js";

type Step = "info" | "client_id" | "client_secret" | "username" | "token" | "done";

interface RedditSetupProps {
  onComplete: (msg: string) => void;
  onCancel: () => void;
}

export function RedditSetup({ onComplete, onCancel }: RedditSetupProps) {
  const [step, setStep] = useState<Step>("info");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [username, setUsername] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [error, setError] = useState("");

  const handleInfoDone = () => setStep("client_id");

  const handleClientId = (val: string) => {
    if (!val.trim()) { setError("Required"); return; }
    setError("");
    setClientId(val.trim());
    setStep("client_secret");
  };

  const handleClientSecret = (val: string) => {
    if (!val.trim()) { setError("Required"); return; }
    setError("");
    setClientSecret(val.trim());
    setStep("username");
  };

  const handleUsername = (val: string) => {
    if (!val.trim()) { setError("Required"); return; }
    setError("");
    setUsername(val.trim());
    setStep("token");
  };

  const handleToken = (val: string) => {
    if (!val.trim()) { setError("Required"); return; }
    setError("");
    setRefreshToken(val.trim());

    const settings = loadSettings();
    settings.reddit = {
      clientId,
      clientSecret,
      refreshToken: val.trim(),
      username,
    };
    saveSettings(settings);
    setStep("done");
    onComplete(`Reddit connected as u/${username}`);
  };

  if (step === "info") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Reddit Setup</Text>
        <Text> </Text>
        <Text>1. Go to: <Text color="cyan">https://www.reddit.com/prefs/apps</Text></Text>
        <Text>2. Click "create another app..."</Text>
        <Text>3. Name: OpenAgent, Type: script</Text>
        <Text>4. Redirect URI: http://localhost:8910/callback</Text>
        <Text>5. Click "create app"</Text>
        <Text> </Text>
        <Text>You'll also need a refresh token.</Text>
        <Text>Easiest way: use <Text color="cyan">https://not-an-aardvark.github.io/reddit-oauth-helper/</Text></Text>
        <Text>Select scopes: submit, identity, read</Text>
        <Text> </Text>
        <Text dimColor>Press Enter to continue</Text>
        <TextInput value="" onChange={() => {}} onSubmit={handleInfoDone} />
      </Box>
    );
  }

  if (step === "client_id") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Reddit — Client ID</Text>
        <Text dimColor>The short string under your app name</Text>
        {error && <Text color="red">{error}</Text>}
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={clientId} onChange={setClientId} onSubmit={handleClientId} /></Box>
      </Box>
    );
  }

  if (step === "client_secret") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Reddit — Client Secret</Text>
        {error && <Text color="red">{error}</Text>}
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={clientSecret} onChange={setClientSecret} onSubmit={handleClientSecret} mask="*" /></Box>
      </Box>
    );
  }

  if (step === "username") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Reddit — Username</Text>
        {error && <Text color="red">{error}</Text>}
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={username} onChange={setUsername} onSubmit={handleUsername} /></Box>
      </Box>
    );
  }

  if (step === "token") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Reddit — Refresh Token</Text>
        <Text dimColor>From the OAuth helper tool</Text>
        {error && <Text color="red">{error}</Text>}
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={refreshToken} onChange={setRefreshToken} onSubmit={handleToken} mask="*" /></Box>
      </Box>
    );
  }

  return null;
}
