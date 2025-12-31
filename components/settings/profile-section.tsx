"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Camera } from "lucide-react";

interface ProfileSectionProps {
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
    createdAt: string;
  };
}

// Mock user data for UI development
const mockUser = {
  name: "John Doe",
  email: "john.doe@gmail.com",
  avatarUrl: undefined,
  createdAt: "2024-12-15T10:30:00Z",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ProfileSection({ user = mockUser }: ProfileSectionProps) {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Your personal account information
        </p>
      </div>

      {/* Profile Card */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Your Profile</CardTitle>
          <CardDescription>
            Manage your profile information. Your name and email are provided by
            Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="size-16">
                <AvatarImage src={user.avatarUrl} alt={user.name} />
                <AvatarFallback className="bg-accent text-accent-foreground text-lg">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="outline"
                size="icon-sm"
                className="absolute -bottom-1 -right-1 size-7 rounded-full border-background bg-background"
                disabled
                title="Avatar is managed by Google"
              >
                <Camera className="size-3.5" />
              </Button>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                Avatar synced from Google
              </p>
            </div>
          </div>

          <Separator />

          {/* Profile Details */}
          <div className="space-y-4">
            {/* Name */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Name
                </label>
                <p className="text-sm text-muted-foreground">{user.name}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                From Google
              </span>
            </div>

            <Separator />

            {/* Email */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Email
                </label>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                Read-only
              </span>
            </div>

            <Separator />

            {/* Account Created */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Account created
                </label>
                <p className="text-sm text-muted-foreground">
                  {formatDate(user.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
