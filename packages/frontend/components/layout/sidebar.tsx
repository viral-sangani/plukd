"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Bookmark,
  Twitter,
  MessageCircle,
  Linkedin,
  Youtube,
  Instagram,
  Globe,
  Menu,
  ChevronsUpDown,
  LogOut,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { api } from "@/lib/api/client"
import type { ContentSource, User, BookmarkCounts } from "@plukd/shared/types"

// Map source keys to Lucide icon components
const sourceIcons: Record<ContentSource, React.ComponentType<{ className?: string }>> = {
  twitter: Twitter,
  reddit: MessageCircle,
  linkedin: Linkedin,
  youtube: Youtube,
  instagram: Instagram,
  web: Globe,
}

const sourceLabels: Record<ContentSource, string> = {
  twitter: "Twitter",
  reddit: "Reddit",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  web: "Web",
}

const sources: ContentSource[] = ["twitter", "reddit", "youtube", "linkedin", "instagram", "web"]

interface NavItemProps {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  isActive?: boolean
  onClick?: () => void
}

function NavItem({ href, icon: Icon, label, count = 0, isActive, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
        "text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a]",
        isActive && "text-[#fafafa] bg-[#27272a]"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#fafafa] rounded-r" />
      )}
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1">{label}</span>
      <span
        className={cn(
          "text-xs tabular-nums",
          isActive ? "text-[#fafafa]" : "text-[#71717a]"
        )}
      >
        {count}
      </span>
    </Link>
  )
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }
  return email.slice(0, 2).toUpperCase()
}

interface UserProfileProps {
  user: User | null
  isLoading?: boolean
}

function UserProfile({ user, isLoading = false }: UserProfileProps) {
  if (isLoading || !user) {
    return (
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="h-8 w-8 rounded-lg bg-[#27272a] animate-pulse" />
        <div className="flex-1 space-y-1">
          <div className="h-4 w-20 rounded bg-[#27272a] animate-pulse" />
          <div className="h-3 w-28 rounded bg-[#27272a] animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[#27272a] transition-colors">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.avatar_url || undefined} alt={user.name || user.email} />
            <AvatarFallback className="rounded-lg bg-[#27272a] text-[#fafafa] text-xs">
              {getInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#fafafa] truncate">
              {user.name || "User"}
            </p>
            <p className="text-xs text-[#71717a] truncate">{user.email}</p>
          </div>
          <ChevronsUpDown className="h-4 w-4 text-[#71717a] shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-56 bg-[#09090b] border-[#27272a]"
      >
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#27272a]" />
        <DropdownMenuItem
          onClick={() => {
            const form = document.createElement("form")
            form.method = "POST"
            form.action = "/api/auth/signout"
            document.body.appendChild(form)
            form.submit()
          }}
          className="flex items-center gap-2 cursor-pointer text-red-400"
        >
          <LogOut className="h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LogoHeader() {
  return (
    <div className="flex items-center gap-2 px-4 py-4 border-b border-[#27272a]">
      <Image
        src="/icon.png"
        alt="Plukd"
        width={32}
        height={32}
        className="rounded-lg"
      />
      <span className="text-lg font-semibold text-[#fafafa]">Plukd</span>
    </div>
  )
}

interface SidebarContentProps {
  pathname: string
  user: User | null
  counts: BookmarkCounts | null
  isLoading?: boolean
  onNavClick?: () => void
}

function SidebarContent({ pathname, user, counts, isLoading = false, onNavClick }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <div className="px-3 space-y-6">
          {/* All Bookmarks */}
          <div>
            <NavItem
              href="/"
              icon={Bookmark}
              label="All Bookmarks"
              count={counts?.total ?? 0}
              isActive={pathname === "/"}
              onClick={onNavClick}
            />
          </div>

          {/* Sources Section */}
          <div>
            <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-[#71717a]">
              Sources
            </h3>
            <nav className="space-y-1">
              {sources.map((source) => {
                const Icon = sourceIcons[source]
                const href = `/source/${source}`
                const isActive = pathname === href
                return (
                  <NavItem
                    key={source}
                    href={href}
                    icon={Icon}
                    label={sourceLabels[source]}
                    count={counts?.bySource[source] ?? 0}
                    isActive={isActive}
                    onClick={onNavClick}
                  />
                )
              })}
            </nav>
          </div>

          {/* Settings */}
          <div className="pt-4 border-t border-[#27272a]">
            <Link
              href="/settings"
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                "text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a]",
                pathname === "/settings" && "text-[#fafafa] bg-[#27272a]"
              )}
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span className="truncate">Settings</span>
            </Link>
          </div>
        </div>
      </ScrollArea>

      {/* User Profile at Bottom */}
      <div className="mt-auto border-t border-[#27272a] p-3">
        <UserProfile user={user} isLoading={isLoading} />
      </div>
    </div>
  )
}

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [counts, setCounts] = useState<BookmarkCounts | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch user data once on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await api.get<User>("/api/user")
        setUser(userData)
      } catch {
        // User fetch failed - user will remain null and show loading skeleton
        // The middleware handles redirecting unauthenticated users to /login
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    fetchUser()
  }, [])

  // Fetch counts on mount, pathname change, window focus, and custom events
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const countsData = await api.get<BookmarkCounts>("/api/bookmarks/counts")
        setCounts(countsData)
      } catch {
        // Silently fail - counts will show 0
      }
    }

    // Initial fetch
    fetchCounts()

    // Refetch on window focus
    const handleFocus = () => fetchCounts()
    window.addEventListener("focus", handleFocus)

    // Refetch on custom event (fired when bookmarks are added/deleted)
    const handleBookmarksUpdated = () => fetchCounts()
    window.addEventListener("bookmarks-updated", handleBookmarksUpdated)

    return () => {
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("bookmarks-updated", handleBookmarksUpdated)
    }
  }, [pathname])

  const closeSheet = () => setOpen(false)

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#09090b] border-b border-[#27272a] flex items-center px-4 gap-3 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a]"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-64 p-0 bg-[#09090b] border-[#27272a] flex flex-col"
          >
            {/* Logo in mobile sheet */}
            <LogoHeader />
            <SidebarContent pathname={pathname} user={user} counts={counts} isLoading={isLoading} onNavClick={closeSheet} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Image
            src="/icon.png"
            alt="Plukd"
            width={28}
            height={28}
            className="rounded-lg"
          />
          <span className="text-lg font-semibold text-[#fafafa]">Plukd</span>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 w-64 bg-[#09090b] border-r border-[#27272a] hidden lg:flex lg:flex-col",
          className
        )}
      >
        {/* Logo/Brand */}
        <LogoHeader />
        <SidebarContent pathname={pathname} user={user} counts={counts} isLoading={isLoading} />
      </aside>
    </>
  )
}
