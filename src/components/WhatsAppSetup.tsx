import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { saveWhatsAppConfig } from "../bridges/whatsapp.js";

type Step = "info" | "phone" | "webhook" | "done";

interface WhatsAppSetupProps {
  onComplete: (msg: string) => void;
  onCancel: () => void;
}

export function WhatsAppSetup({ onComplete, onCancel }: WhatsAppSetupProps) {
  const [step, setStep] = useState<Step>("info");
  const [phone, setPhone] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const verifyToken = Math.random().toString(36).slice(2, 14);

  useInput((_, key) => {
    if (!key.escape) return;
    switch (step) {
      case "info": onCancel(); return;
      case "phone": setStep("info"); return;
      case "webhook": setStep("phone"); return;
    }
  });

  const handleInfoDone = () => setStep("phone");

  const handlePhone = (val: string) => {
    setPhone(val.trim());
    setStep("webhook");
  };

  const handleWebhook = (val: string) => {
    saveWhatsAppConfig({
      enabled: true,
      phoneNumber: phone,
      webhookUrl: val.trim() || undefined,
      verifyToken,
    });
    setStep("done");
    onComplete(
      `WhatsApp bridge configured.\n` +
      `  Webhook endpoint: http://localhost:8920/webhook\n` +
      `  Verify token: ${verifyToken}\n` +
      `  Send messages to /send endpoint or configure Meta webhook.\n` +
      `  Bridge starts automatically on next openagent launch.`
    );
  };

  if (step === "info") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">WhatsApp Bridge Setup</Text>
        <Text> </Text>
        <Text>This sets up a webhook server so you can send messages</Text>
        <Text>to OpenAgent via WhatsApp.</Text>
        <Text> </Text>
        <Text bold>Option A: Meta WhatsApp Business API</Text>
        <Text>  1. Go to developers.facebook.com, create an app</Text>
        <Text>  2. Add WhatsApp product</Text>
        <Text>  3. Set webhook URL to: http://YOUR_SERVER:8920/webhook</Text>
        <Text>  4. Use the verify token shown after setup</Text>
        <Text> </Text>
        <Text bold>Option B: Direct HTTP (simpler)</Text>
        <Text>  Send POST to http://localhost:8920/send with:</Text>
        <Text>  {"  {\"message\": \"your message here\"}"}</Text>
        <Text>  Works with any automation tool (n8n, Make, curl)</Text>
        <Text> </Text>
        <Text dimColor>Press Enter to continue</Text>
        <TextInput value="" onChange={() => {}} onSubmit={handleInfoDone} />
      </Box>
    );
  }

  if (step === "phone") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Your phone number (optional, for Meta API):</Text>
        <Text dimColor>Press Enter to skip</Text>
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={phone} onChange={setPhone} onSubmit={handlePhone} /></Box>
      </Box>
    );
  }

  if (step === "webhook") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">WhatsApp API URL (optional, for sending replies):</Text>
        <Text dimColor>Meta WhatsApp Cloud API URL — press Enter to skip</Text>
        <Box><Text color="cyan">{"❯ "}</Text><TextInput value={webhookUrl} onChange={setWebhookUrl} onSubmit={handleWebhook} /></Box>
      </Box>
    );
  }

  return null;
}
