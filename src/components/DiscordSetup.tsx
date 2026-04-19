import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { saveDiscordConfig } from "../bridges/discord.js";

type Step = "info" | "token" | "channel" | "users" | "done";

interface DiscordSetupProps {
  onComplete: (msg: string) => void;
  onCancel: () => void;
}

export function DiscordSetup({ onComplete, onCancel }: DiscordSetupProps) {
  const [step, setStep] = useState<Step>("info");
  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState("");
  const [allowedUsers, setAllowedUsers] = useState("");

  useInput((_, key) => {
    if (!key.escape) return;
    switch (step) {
      case "info": onCancel(); return;
      case "token": setStep("info"); return;
      case "channel": setStep("token"); return;
      case "users": setStep("channel"); return;
    }
  });

  const handleInfoDone = () => setStep("token");

  const handleToken = (val: string) => {
    if (!val.trim()) return;
    setBotToken(val.trim());
    setStep("channel");
  };

  const handleChannel = (val: string) => {
    if (!val.trim()) return;
    setChannelId(val.trim());
    setStep("users");
  };

  const handleUsers = (val: string) => {
    const users = val.trim() ? val.split(",").map((u) => u.trim()).filter(Boolean) : [];

    saveDiscordConfig({
      enabled: true,
      botToken,
      channelId,
      allowedUsers: users.length > 0 ? users : undefined,
    });

    setStep("done");
    onComplete(
      `Discord bridge configured.\n` +
      `  Channel: ${channelId}\n` +
      `  ${users.length ? `Allowed users: ${users.join(", ")}` : "All users allowed"}\n` +
      `  Users type: !agent <message> in the channel.\n` +
      `  Bridge starts automatically on next openagent launch.`
    );
  };

  if (step === "info") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Discord Bridge Setup</Text>
        <Text> </Text>
        <Text>This connects a Discord bot to OpenAgent so you can</Text>
        <Text>send commands via Discord messages.</Text>
        <Text> </Text>
        <Text>1. Go to: discord.com/developers/applications</Text>
        <Text>2. Create a new application</Text>
        <Text>3. Go to Bot tab, click "Reset Token", copy it</Text>
        <Text>4. Enable MESSAGE CONTENT INTENT under Bot</Text>
        <Text>5. Go to OAuth2 URL Generator:</Text>
        <Text>   Scopes: bot</Text>
        <Text>   Permissions: Send Messages, Read Message History</Text>
        <Text>6. Invite the bot to your server with the generated URL</Text>
        <Text> </Text>
        <Text>Usage: type <Text bold>!agent your message here</Text> in the channel</Text>
        <Text> </Text>
        <Text dimColor>Press Enter to continue</Text>
        <TextInput value="" onChange={() => {}} onSubmit={handleInfoDone} />
      </Box>
    );
  }

  if (step === "token") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Bot Token:</Text>
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={botToken} onChange={setBotToken} onSubmit={handleToken} mask="*" /></Box>
      </Box>
    );
  }

  if (step === "channel") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Channel ID:</Text>
        <Text dimColor>Right-click channel, Copy Channel ID (enable Developer Mode in Discord settings)</Text>
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={channelId} onChange={setChannelId} onSubmit={handleChannel} /></Box>
      </Box>
    );
  }

  if (step === "users") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Allowed User IDs (optional, comma-separated):</Text>
        <Text dimColor>Leave empty to allow all users. Right-click user, Copy User ID.</Text>
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={allowedUsers} onChange={setAllowedUsers} onSubmit={handleUsers} /></Box>
      </Box>
    );
  }

  return null;
}
