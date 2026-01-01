"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User, MessageCircle } from "lucide-react";

interface SettingsLayoutProps {
  children?: React.ReactNode;
  activeSection: "profile" | "telegram";
  onSectionChange: (section: "profile" | "telegram") => void;
  profileContent: React.ReactNode;
  telegramContent: React.ReactNode;
}

const navItems = [
  {
    id: "profile" as const,
    label: "Profile",
    icon: User,
  },
  {
    id: "telegram" as const,
    label: "Telegram",
    icon: MessageCircle,
  },
];

export function SettingsLayout({
  activeSection,
  onSectionChange,
  profileContent,
  telegramContent,
}: SettingsLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account settings and Telegram connection
          </p>
        </div>

        {/* Mobile: Tabs */}
        <div className="lg:hidden">
          <Tabs
            value={activeSection}
            onValueChange={(value) =>
              onSectionChange(value as "profile" | "telegram")
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              {navItems.map((item) => (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="flex items-center gap-2"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="profile" className="mt-6">
              {profileContent}
            </TabsContent>
            <TabsContent value="telegram" className="mt-6">
              {telegramContent}
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop: Sidebar + Content */}
        <div className="hidden lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
          {/* Sidebar Navigation */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent/50 text-foreground"
                      : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <item.icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Main Content */}
          <main className="min-w-0">
            {activeSection === "profile" && profileContent}
            {activeSection === "telegram" && telegramContent}
          </main>
        </div>
      </div>
    </div>
  );
}
