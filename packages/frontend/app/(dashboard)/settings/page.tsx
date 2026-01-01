"use client";

import * as React from "react";
import { Loader2, Moon, Bell, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TelegramSection } from "@/components/settings/telegram-section";
import { api } from "@/lib/api/client";
import type { User } from "@plukd/shared/types";

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

// Section header component - Orbmarkets style
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-4">
      {children}
    </h2>
  );
}

// Card with corner brackets - Orbmarkets style
function SettingsCard({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "danger" }) {
  return (
    <div
      className={`relative bg-background-muted border rounded-none p-6 ${
        variant === "danger" ? "border-red-900/50" : "border-border"
      }`}
      data-corners="diagonal"
    >
      {children}
    </div>
  );
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
        const [userData, telegramData] = await Promise.all([
          api.get<User>("/api/user").catch(() => null),
          api.get<TelegramStatus>("/api/telegram/link").catch(() => null),
        ]);

        if (userData) {
          setUser(userData);
        } else {
          // Use mock user when not authenticated
          setUser(mockUser);
        }

        if (telegramData) {
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
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 lg:px-6">
      {/* Page Title */}
      <h1 className="text-xl font-mono font-semibold text-foreground mb-8 tracking-wide">
        Settings
      </h1>

      {/* Profile Section */}
      <section className="mb-8">
        <SectionHeader>Profile</SectionHeader>
        <SettingsCard>
          <div className="space-y-4">
            {/* Name */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-mono font-medium text-foreground">Name</label>
                <p className="text-sm font-mono text-foreground-muted">{user?.name || "User"}</p>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-foreground-muted">From Google</span>
            </div>

            <div className="border-t border-border" />

            {/* Email */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-mono font-medium text-foreground">Email</label>
                <p className="text-sm font-mono text-foreground-muted">{user?.email}</p>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-foreground-muted">Read-only</span>
            </div>

            <div className="border-t border-border" />

            {/* Member Since */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-mono font-medium text-foreground">Member since</label>
                <p className="text-sm font-mono text-foreground-muted">
                  {user?.created_at ? formatDate(user.created_at) : "Unknown"}
                </p>
              </div>
            </div>
          </div>
        </SettingsCard>
      </section>

      {/* Preferences Section */}
      <section className="mb-8">
        <SectionHeader>Preferences</SectionHeader>
        <SettingsCard>
          <div className="space-y-4">
            {/* Dark Mode */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="h-4 w-4 text-foreground-muted" />
                <div>
                  <label className="text-sm font-mono font-medium text-foreground">Dark mode</label>
                  <p className="text-[11px] font-mono text-foreground-muted">Always on</p>
                </div>
              </div>
              <Switch checked={darkMode} disabled />
            </div>

            <div className="border-t border-border" />

            {/* Email Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-foreground-muted" />
                <div>
                  <label className="text-sm font-mono font-medium text-foreground">Email notifications</label>
                  <p className="text-[11px] font-mono text-foreground-muted">Receive updates about your bookmarks</p>
                </div>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>
          </div>
        </SettingsCard>
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
              await api.delete("/api/telegram/link");
              setTelegramStatus({ isLinked: false, username: null, linkedAt: null });
            } catch (error) {
              console.error("Error disconnecting:", error);
            }
          }}
        />
      </section>

      {/* Danger Zone Section */}
      <section className="mb-8">
        <SectionHeader>Danger Zone</SectionHeader>
        <SettingsCard variant="danger">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-none bg-red-500/10 border border-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-mono font-medium text-foreground mb-1">Delete Account</p>
              <p className="text-sm font-mono text-foreground-muted mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled
                className="font-mono text-red-400 border-red-900/50 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              >
                Delete Account
              </Button>
            </div>
          </div>
        </SettingsCard>
      </section>
    </div>
  );
}
