"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2 } from "lucide-react";

interface TelegramStatusCardProps {
  username: string;
  connectedAt: string;
  onDisconnect: () => void;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function TelegramStatusCard({
  username,
  connectedAt,
  onDisconnect,
}: TelegramStatusCardProps) {
  return (
    <div className="relative bg-background-muted border border-border rounded-none p-6" data-corners="diagonal">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-none bg-[#0088cc]/10 border border-[#0088cc]/20">
            <MessageCircle className="h-5 w-5 text-[#0088cc]" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
            <CheckCircle2 className="h-3 w-3 text-white" />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono font-medium text-foreground">Connected</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-mono font-medium uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">
              Active
            </span>
          </div>
          <p className="text-sm font-mono text-foreground-muted">@{username}</p>
          <p className="text-[11px] font-mono text-foreground-muted mt-1">
            Connected on {formatDate(connectedAt)}
          </p>
        </div>
      </div>

      {/* Status Message */}
      <div className="rounded-none bg-green-500/10 border border-green-500/20 p-4 mb-6">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span className="text-sm font-mono font-medium text-green-400">
            Connected and ready
          </span>
        </div>
        <p className="mt-1 text-[11px] font-mono text-foreground-muted">
          Send any link to @PlukdBot to save it to your library
        </p>
      </div>

      {/* Disconnect Button */}
      <Button
        variant="outline"
        className="w-full font-mono text-red-400 border-red-900/50 hover:bg-red-500/10 hover:text-red-400"
        onClick={onDisconnect}
      >
        Disconnect Telegram
      </Button>
      <p className="mt-2 text-center text-[11px] font-mono text-foreground-muted">
        You can reconnect anytime by sending /start to @PlukdBot
      </p>
    </div>
  );
}
