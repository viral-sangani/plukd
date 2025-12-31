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
    <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0088cc]/10">
            <MessageCircle className="h-5 w-5 text-[#0088cc]" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
            <CheckCircle2 className="h-3 w-3 text-white" />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-[#fafafa]">Connected</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
              Active
            </span>
          </div>
          <p className="text-sm text-[#a1a1aa]">@{username}</p>
          <p className="text-xs text-[#71717a] mt-1">
            Connected on {formatDate(connectedAt)}
          </p>
        </div>
      </div>

      {/* Status Message */}
      <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 mb-6">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span className="text-sm font-medium text-green-400">
            Connected and ready
          </span>
        </div>
        <p className="mt-1 text-xs text-[#a1a1aa]">
          Send any link to @PlukdBot to save it to your library
        </p>
      </div>

      {/* Disconnect Button */}
      <Button
        variant="outline"
        className="w-full text-red-400 border-red-900/50 hover:bg-red-500/10 hover:text-red-400"
        onClick={onDisconnect}
      >
        Disconnect Telegram
      </Button>
      <p className="mt-2 text-center text-xs text-[#71717a]">
        You can reconnect anytime by sending /start to @PlukdBot
      </p>
    </div>
  );
}
