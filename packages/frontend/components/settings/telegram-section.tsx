"use client";

import * as React from "react";
import { TelegramConnectCard } from "./telegram-connect-card";
import { TelegramStatusCard } from "./telegram-status-card";
import { DisconnectDialog } from "./disconnect-dialog";

interface TelegramConnection {
  isConnected: boolean;
  username?: string;
  connectedAt?: string;
}

interface TelegramSectionProps {
  connection?: TelegramConnection;
  onDisconnect?: () => void;
}

// Default disconnected state
const defaultDisconnected: TelegramConnection = {
  isConnected: false,
};

export function TelegramSection({
  connection,
  onDisconnect,
}: TelegramSectionProps) {
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = React.useState(false);

  // Use provided connection or default to disconnected
  const currentConnection = connection ?? defaultDisconnected;

  const handleDisconnect = async () => {
    setIsDisconnecting(true);

    try {
      if (onDisconnect) {
        await onDisconnect();
      }
    } finally {
      setIsDisconnecting(false);
      setShowDisconnectDialog(false);
    }
  };

  return (
    <div>
      {/* Section Header - Orbmarkets style */}
      <h2 className="text-[11px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-4">
        Telegram Integration
      </h2>

      {/* Connection Card */}
      {currentConnection.isConnected ? (
        <TelegramStatusCard
          username={currentConnection.username!}
          connectedAt={currentConnection.connectedAt!}
          onDisconnect={() => setShowDisconnectDialog(true)}
        />
      ) : (
        <TelegramConnectCard />
      )}

      {/* Disconnect Dialog */}
      <DisconnectDialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
        onConfirm={handleDisconnect}
        isDisconnecting={isDisconnecting}
      />
    </div>
  );
}
