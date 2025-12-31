"use client";

import * as React from "react";
import { Loader2, Moon, Bell, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TelegramSection } from "@/components/settings/telegram-section";
import type { User } from "@/types";

interface TelegramStatus {
  isLinked: boolean;
  username: string | null;
  linkedAt: string | null;
}

// Mock user for development
const mockUser: User = {
  id: "mock-user-1",
  email: "john.doe@gmail.com",
  name: "John Doe",
  avatar_url: null,
  telegram_chat_id: null,
  telegram_username: null,
  telegram_linked_at: null,
  created_at: "2024-12-15T10:30:00Z",
  updated_at: new Date().toISOString(),
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function SettingsPage() {
  const [user, setUser] = React.useState<User | null>(null);
  const [telegramStatus, setTelegramStatus] = React.useState<TelegramStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Placeholder preference states
  const [darkMode] = React.useState(true);
  const [emailNotifications, setEmailNotifications] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [userResponse, telegramResponse] = await Promise.all([
          fetch("/api/user"),
          fetch("/api/telegram/link"),
        ]);

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData);
        } else {
          // Use mock user when not authenticated
          setUser(mockUser);
        }

        if (telegramResponse.ok) {
          const telegramData = await telegramResponse.json();
          setTelegramStatus(telegramData);
        } else {
          setTelegramStatus({ isLinked: false, username: null, linkedAt: null });
        }
      } catch (error) {
        console.error("Error fetching settings data:", error);
        // Use mock data on error
        setUser(mockUser);
        setTelegramStatus({ isLinked: false, username: null, linkedAt: null });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#fafafa]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 lg:px-6">
      <h1 className="text-2xl font-bold text-[#fafafa] mb-8">Settings</h1>

      {/* Profile Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[#fafafa] mb-4">Profile</h2>
        <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6">
          <div className="space-y-4">
            {/* Name */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-[#fafafa]">Name</label>
                <p className="text-sm text-[#a1a1aa]">{user?.name || "User"}</p>
              </div>
              <span className="text-xs text-[#71717a]">From Google</span>
            </div>

            <div className="border-t border-[#27272a]" />

            {/* Email */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-[#fafafa]">Email</label>
                <p className="text-sm text-[#a1a1aa]">{user?.email}</p>
              </div>
              <span className="text-xs text-[#71717a]">Read-only</span>
            </div>

            <div className="border-t border-[#27272a]" />

            {/* Member Since */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-[#fafafa]">Member since</label>
                <p className="text-sm text-[#a1a1aa]">
                  {user?.created_at ? formatDate(user.created_at) : "Unknown"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Preferences Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[#fafafa] mb-4">Preferences</h2>
        <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6">
          <div className="space-y-4">
            {/* Dark Mode */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="h-4 w-4 text-[#a1a1aa]" />
                <div>
                  <label className="text-sm font-medium text-[#fafafa]">Dark mode</label>
                  <p className="text-xs text-[#71717a]">Always on</p>
                </div>
              </div>
              <Switch checked={darkMode} disabled />
            </div>

            <div className="border-t border-[#27272a]" />

            {/* Email Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-[#a1a1aa]" />
                <div>
                  <label className="text-sm font-medium text-[#fafafa]">Email notifications</label>
                  <p className="text-xs text-[#71717a]">Receive updates about your bookmarks</p>
                </div>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Telegram Integration Section */}
      <section className="mb-8">
        <TelegramSection
          connection={{
            isConnected: telegramStatus?.isLinked ?? false,
            username: telegramStatus?.username ?? undefined,
            connectedAt: telegramStatus?.linkedAt ?? undefined,
          }}
          onDisconnect={async () => {
            try {
              const response = await fetch("/api/telegram/link", { method: "DELETE" });
              if (response.ok) {
                setTelegramStatus({ isLinked: false, username: null, linkedAt: null });
              }
            } catch (error) {
              console.error("Error disconnecting:", error);
            }
          }}
        />
      </section>

      {/* Danger Zone Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[#fafafa] mb-4">Danger Zone</h2>
        <div className="bg-[#18181b] border border-red-900/50 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#fafafa] mb-1">Delete Account</p>
              <p className="text-sm text-[#a1a1aa] mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled
                className="text-red-400 border-red-900/50 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              >
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
