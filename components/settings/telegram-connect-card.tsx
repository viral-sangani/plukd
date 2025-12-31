"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, ExternalLink, Loader2 } from "lucide-react";

const steps = [
  {
    number: 1,
    title: "Open @PlukdBot",
    description: "Click the link below to open our Telegram bot",
  },
  {
    number: 2,
    title: "Send /start",
    description: "The bot will give you a 6-character code",
  },
  {
    number: 3,
    title: "Enter the code",
    description: "Paste the code below to link your account",
  },
];

export function TelegramConnectCard() {
  const [inputCode, setInputCode] = React.useState("");
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const verifyCode = async () => {
    if (!inputCode || inputCode.length !== 6) {
      setError("Please enter a 6-character code");
      return;
    }
    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch("/api/telegram/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inputCode.toUpperCase() }),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const data = await response.json();
        setError(data.error || "Invalid or expired code");
      }
    } catch (err) {
      console.error("Error verifying code:", err);
      setError("Failed to verify code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0088cc]/10">
          <MessageCircle className="h-5 w-5 text-[#0088cc]" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-[#fafafa]">Connect Telegram</h3>
          <p className="text-sm text-[#a1a1aa]">
            Link your Telegram account to save bookmarks via chat
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-6">
        <h4 className="text-sm font-medium text-[#fafafa]">How to connect</h4>
        {steps.map((step) => (
          <div key={step.number} className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#27272a] text-xs font-medium text-[#fafafa]">
              {step.number}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#fafafa]">{step.title}</p>
              <p className="text-xs text-[#71717a]">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bot Link */}
      <Button className="w-full gap-2 mb-4" asChild>
        <a
          href="https://t.me/PlukdBot"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="h-4 w-4" />
          Open @PlukdBot in Telegram
        </a>
      </Button>

      {/* Code Input */}
      <div className="rounded-lg bg-[#27272a] p-4 mb-4">
        <p className="text-xs text-[#71717a] mb-3 text-center">
          Enter the 6-character code from the bot
        </p>
        <Input
          type="text"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="ABC123"
          className="font-mono text-2xl font-bold tracking-[0.3em] text-center uppercase h-14 bg-[#18181b] border-[#3f3f46] text-[#fafafa] placeholder:text-[#52525b]"
        />
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-900/50 rounded-md p-3 mb-4">
          {error}
        </div>
      )}

      <Button
        className="w-full"
        onClick={verifyCode}
        disabled={isVerifying || inputCode.length !== 6}
      >
        {isVerifying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Linking...
          </>
        ) : (
          "Link Account"
        )}
      </Button>
    </div>
  );
}
