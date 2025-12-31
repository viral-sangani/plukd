"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DisconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDisconnecting?: boolean;
}

export function DisconnectDialog({
  open,
  onOpenChange,
  onConfirm,
  isDisconnecting = false,
}: DisconnectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-warning-background">
            <AlertTriangle className="size-6 text-warning" />
          </div>
          <DialogTitle className="text-center">
            Disconnect Telegram?
          </DialogTitle>
          <DialogDescription className="text-center">
            Are you sure you want to disconnect your Telegram account? You will
            no longer be able to save bookmarks by sending links to @PlukdBot.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-warning-background/50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="text-sm text-foreground">
              <p className="font-medium">What happens when you disconnect:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                <li>You cannot save new bookmarks via Telegram</li>
                <li>Your existing bookmarks will remain safe</li>
                <li>You can reconnect anytime</li>
              </ul>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDisconnecting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDisconnecting}
            className="flex-1"
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
