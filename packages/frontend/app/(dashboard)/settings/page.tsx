"use client";

import * as React from "react";
import { Loader2, Moon, Sun, LogOut, AlertCircle, RefreshCw } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative bg-background-muted border border-border rounded-none p-6"
      data-corners="diagonal"
    >
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<User | null>(null);
  const [telegramStatus, setTelegramStatus] = React.useState<TelegramStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  const { theme, setTheme } = useTheme();

  // Ensure component is mounted before accessing theme to avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = () => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/signout";
    document.body.appendChild(form);
    form.submit();
  };

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [userData, telegramData] = await Promise.all([
        api.get<User>("/api/user"),
        api.get<TelegramStatus>("/api/telegram/link").catch(() => null),
      ]);

      setUser(userData);

      if (telegramData) {
        setTelegramStatus(telegramData);
      } else {
        setTelegramStatus({ isLinked: false, username: null, linkedAt: null });
      }
    } catch (err) {
      console.error("Error fetching settings data:", err);
      if (err instanceof Error && err.message === "Unauthorized") {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <div className="text-center">
          <h2 className="text-lg font-mono font-semibold text-foreground mb-2">
            Failed to load settings
          </h2>
          <p className="text-sm font-mono text-foreground-muted mb-4">
            {error}
          </p>
          <Button
            variant="outline"
            onClick={fetchData}
            className="font-mono gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <AlertCircle className="h-12 w-12 text-foreground-muted" />
        <div className="text-center">
          <h2 className="text-lg font-mono font-semibold text-foreground mb-2">
            Not signed in
          </h2>
          <p className="text-sm font-mono text-foreground-muted mb-4">
            Please sign in to view your settings.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/login")}
            className="font-mono"
          >
            Sign in
          </Button>
        </div>
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
                <p className="text-sm font-mono text-foreground-muted">{user.name || "User"}</p>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-foreground-muted">From Google</span>
            </div>

            <div className="border-t border-border" />

            {/* Email */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-mono font-medium text-foreground">Email</label>
                <p className="text-sm font-mono text-foreground-muted">{user.email}</p>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-foreground-muted">Read-only</span>
            </div>

            <div className="border-t border-border" />

            {/* Member Since */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-mono font-medium text-foreground">Member since</label>
                <p className="text-sm font-mono text-foreground-muted">
                  {user.created_at ? formatDate(user.created_at) : "Unknown"}
                </p>
              </div>
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
              toast.success("Telegram disconnected successfully", {
                description: "You can reconnect anytime by sending /start to @PlukdBot",
              });
            } catch (err) {
              console.error("Error disconnecting:", err);
              toast.error("Failed to disconnect Telegram", {
                description: err instanceof Error ? err.message : "Please try again",
              });
              throw err;
            }
          }}
        />
      </section>

      {/* Preferences Section */}
      <section className="mb-8">
        <SectionHeader>Preferences</SectionHeader>
        <SettingsCard>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mounted && theme === "dark" ? (
                <Moon className="h-4 w-4 text-foreground-muted" />
              ) : (
                <Sun className="h-4 w-4 text-foreground-muted" />
              )}
              <div>
                <label className="text-sm font-mono font-medium text-foreground">Dark mode</label>
                <p className="text-[11px] font-mono text-foreground-muted">
                  {mounted ? (theme === "dark" ? "Currently on" : "Currently off") : "Loading..."}
                </p>
              </div>
            </div>
            <Switch
              checked={mounted ? theme === "dark" : true}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              disabled={!mounted}
            />
          </div>
        </SettingsCard>
      </section>

      {/* Account Section */}
      <section className="mb-8">
        <SectionHeader>Account</SectionHeader>
        <SettingsCard>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LogOut className="h-4 w-4 text-foreground-muted" />
              <div>
                <p className="text-sm font-mono font-medium text-foreground">Sign out</p>
                <p className="text-[11px] font-mono text-foreground-muted">Sign out of your account on this device</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="font-mono"
            >
              Sign out
            </Button>
          </div>
        </SettingsCard>
      </section>
    </div>
  );
}
