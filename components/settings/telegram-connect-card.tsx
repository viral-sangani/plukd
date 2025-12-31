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
    <div className="relative bg-background-muted border border-border rounded-none p-6" data-corners="diagonal">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-none bg-[#0088cc]/10 border border-[#0088cc]/20">
          <MessageCircle className="h-5 w-5 text-[#0088cc]" />
        </div>
        <div>
          <h3 className="text-sm font-mono font-medium text-foreground">Connect Telegram</h3>
          <p className="text-sm font-mono text-foreground-muted">
            Link your Telegram account to save bookmarks via chat
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-6">
        <h4 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted">How to connect</h4>
        {steps.map((step) => (
          <div key={step.number} className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none bg-background-emphasis border border-border text-[10px] font-mono font-medium text-foreground">
              {step.number}
            </div>
            <div className="flex-1">
              <p className="text-sm font-mono font-medium text-foreground">{step.title}</p>
              <p className="text-[11px] font-mono text-foreground-muted">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bot Link */}
      <Button className="w-full gap-2 mb-4 font-mono" asChild>
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
      <div className="rounded-none bg-background-emphasis border border-border p-4 mb-4">
        <p className="text-[11px] font-mono text-foreground-muted mb-3 text-center">
          Enter the 6-character code from the bot
        </p>
        <Input
          type="text"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="ABC123"
          className="font-mono text-2xl font-bold tracking-[0.3em] text-center uppercase h-14 bg-background border-border text-foreground placeholder:text-foreground-muted"
        />
      </div>

      {error && (
        <div className="text-sm font-mono text-red-400 bg-red-500/10 border border-red-900/50 rounded-none p-3 mb-4">
          {error}
        </div>
      )}

      <Button
        className="w-full font-mono"
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
