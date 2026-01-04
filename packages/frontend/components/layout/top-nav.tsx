"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Bookmark,
  Twitter,
  MessageCircle,
  Linkedin,
  Youtube,
  Instagram,
  Globe,
  Menu,
  Search,
  Settings,
  LogOut,
  ChevronDown,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  SheetHeader,
  SheetTitle,
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

interface SearchBarFallbackProps {
  className?: string
}

function SearchBarFallback({ className }: SearchBarFallbackProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground-muted pointer-events-none" />
      <input
        type="text"
        disabled
        placeholder="Search"
        className={cn(
          "w-full h-9 pl-10 pr-16 rounded-none border border-border bg-background-subtle text-foreground text-sm font-mono",
          "placeholder:text-foreground-muted placeholder:font-mono",
          "transition-colors opacity-50"
        )}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <kbd className="kbd">
          <span className="text-[10px]">&#8984;</span>K
        </kbd>
      </div>
    </div>
  )
}

interface SearchBarProps {
  className?: string
  onSearch?: () => void
}

function SearchBar({ className, onSearch }: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlSearchValue = searchParams.get("search") || ""
  const [value, setValue] = useState(urlSearchValue)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const updateSearch = useCallback(
    (searchValue: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (searchValue) {
        params.set("search", searchValue)
      } else {
        params.delete("search")
      }
      router.push(`/?${params.toString()}`)
      onSearch?.()
    },
    [router, searchParams, onSearch]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      updateSearch(newValue)
    }, 300)
  }

  const handleClear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setValue("")
    updateSearch("")
  }, [updateSearch])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      updateSearch(value)
    }
  }

  return (
    <div className={cn("relative group", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground-muted pointer-events-none group-focus-within:text-accent transition-colors" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search"
        className={cn(
          "w-full h-9 pl-10 pr-16 rounded-none border border-border bg-background-subtle text-foreground text-sm font-mono",
          "placeholder:text-foreground-muted placeholder:font-mono",
          "focus:outline-none focus:border-accent focus:ring-[2px] focus:ring-accent/20",
          "transition-[color,box-shadow,border-color]"
        )}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              "p-0.5 rounded-sm",
              "text-foreground-muted hover:text-accent hover:bg-accent/10",
              "transition-colors"
            )}
          >
            <X className="size-4" />
            <span className="sr-only">Clear search</span>
          </button>
        )}
        {!value && (
          <kbd className="kbd">
            <span className="text-[10px]">&#8984;</span>K
          </kbd>
        )}
      </div>
    </div>
  )
}

interface SourcesDropdownProps {
  counts: BookmarkCounts | null
  currentSource: string | null
}

function SourcesDropdown({ counts, currentSource }: SourcesDropdownProps) {
  const getCurrentLabel = () => {
    if (!currentSource) return "Sources"
    return sourceLabels[currentSource as ContentSource] || "Sources"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-9 px-3 text-sm font-medium gap-1.5",
            "text-foreground-muted hover:text-foreground hover:bg-transparent",
            currentSource && "text-foreground"
          )}
        >
          {getCurrentLabel()}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-48 bg-background border-border"
      >
        <DropdownMenuItem asChild>
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              !currentSource && "text-accent"
            )}
          >
            <Bookmark className="size-4" />
            <span className="flex-1">All Sources</span>
            <span className="text-xs text-foreground-muted tabular-nums font-mono">
              {counts?.total ?? 0}
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border" />
        {sources.map((source) => {
          const Icon = sourceIcons[source]
          const isActive = currentSource === source
          return (
            <DropdownMenuItem key={source} asChild>
              <Link
                href={`/?source=${source}`}
                className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  isActive && "text-accent"
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1">{sourceLabels[source]}</span>
                <span className="text-xs text-foreground-muted tabular-nums font-mono">
                  {counts?.bySource[source] ?? 0}
                </span>
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface MobileNavContentProps {
  pathname: string
  user: User | null
  counts: BookmarkCounts | null
  currentSource: string | null
  isLoading?: boolean
  onNavClick?: () => void
}

function MobileNavContent({ pathname, user, counts, currentSource, isLoading = false, onNavClick }: MobileNavContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 pb-4">
        <Suspense fallback={<SearchBarFallback className="w-full" />}>
          <SearchBar className="w-full" onSearch={onNavClick} />
        </Suspense>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        <Link
          href="/"
          onClick={onNavClick}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
            "text-foreground-muted hover:text-foreground hover:bg-background-emphasis",
            pathname === "/" && !currentSource && "text-foreground bg-background-emphasis border-l-2 border-accent"
          )}
        >
          <Bookmark className="size-4" />
          <span className="flex-1">All Bookmarks</span>
          <span className="text-xs text-foreground-muted tabular-nums font-mono">
            {counts?.total ?? 0}
          </span>
        </Link>

        <div className="pt-4 pb-2">
          <h3 className="px-3 text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted">
            Sources
          </h3>
        </div>

        {sources.map((source) => {
          const Icon = sourceIcons[source]
          const href = `/?source=${source}`
          const isActive = currentSource === source
          return (
            <Link
              key={source}
              href={href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-none text-sm font-medium font-mono transition-colors",
                "text-foreground-muted hover:text-foreground hover:bg-background-emphasis",
                isActive && "text-foreground bg-background-emphasis border-l-2 border-accent"
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{sourceLabels[source]}</span>
              <span className="text-xs text-foreground-muted tabular-nums font-mono">
                {counts?.bySource[source] ?? 0}
              </span>
            </Link>
          )
        })}

        <div className="pt-4 border-t border-border mt-4">
          <Link
            href="/settings"
            onClick={onNavClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-none text-sm font-medium font-mono transition-colors",
              "text-foreground-muted hover:text-foreground hover:bg-background-emphasis",
              pathname === "/settings" && "text-foreground bg-background-emphasis"
            )}
          >
            <Settings className="size-4" />
            <span>Settings</span>
          </Link>
        </div>
      </nav>

      {/* User info at bottom */}
      <div className="mt-auto border-t border-border p-4">
        {isLoading || !user ? (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-background-emphasis animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-24 rounded bg-background-emphasis animate-pulse" />
              <div className="h-3 w-32 rounded bg-background-emphasis animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar_url || undefined} alt={user.name || user.email} />
              <AvatarFallback className="bg-background-emphasis text-foreground text-sm font-mono">
                {getInitials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate font-mono">
                {user.name || "User"}
              </p>
              <p className="text-xs text-foreground-muted truncate font-mono">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => {
                const form = document.createElement("form")
                form.method = "POST"
                form.action = "/api/auth/signout"
                document.body.appendChild(form)
                form.submit()
              }}
            >
              <LogOut className="size-4" />
              <span className="sr-only">Log out</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

interface TopNavProps {
  className?: string
}

function TopNavInner({ className }: TopNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [counts, setCounts] = useState<BookmarkCounts | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Determine current source from query params
  const currentSource = searchParams.get("source")

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
  const closeSearchSheet = () => setSearchOpen(false)

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 h-14 bg-background border-b border-border z-50",
        className
      )}
    >
      <div className="h-full max-w-screen-2xl mx-auto px-4 flex items-center gap-4 relative">
        {/* Mobile Menu Button */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="group lg:hidden hover:bg-background-emphasis"
            >
              <Menu className="size-5 transition-colors text-foreground-muted group-hover:text-foreground" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-80 p-0 bg-background border-border flex flex-col"
          >
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle className="flex items-center gap-2 text-foreground font-mono">
                <Image
                  src="/icon.png"
                  alt="Plukd"
                  width={28}
                  height={28}
                  className="rounded-lg"
                />
                Plukd
              </SheetTitle>
            </SheetHeader>
            <MobileNavContent
              pathname={pathname}
              user={user}
              counts={counts}
              currentSource={currentSource}
              isLoading={isLoading}
              onNavClick={closeSheet}
            />
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/icon.png"
            alt="Plukd"
            width={28}
            height={28}
            className="rounded-lg"
          />
          <span className="text-lg font-semibold text-foreground hidden sm:block font-mono tracking-wide">
            Plukd
          </span>
        </Link>

        {/* Search Bar - Desktop (Centered) */}
        <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 w-full max-w-md px-4">
          <Suspense fallback={<SearchBarFallback />}>
            <SearchBar />
          </Suspense>
        </div>

        {/* Spacer - pushes nav to the right */}
        <div className="flex-1" />

        {/* Navigation Links - Desktop */}
        <nav className="hidden lg:flex items-center gap-1">
          <Link
            href="/"
            className={cn(
              "relative px-3 py-2 text-sm font-medium font-mono transition-colors",
              "text-foreground-muted hover:text-foreground",
              pathname === "/" && "text-foreground"
            )}
          >
            Bookmarks
          </Link>

          <SourcesDropdown counts={counts} currentSource={currentSource} />
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile Search Button */}
          <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="group lg:hidden hover:bg-background-emphasis"
              >
                <Search className="size-5 transition-colors text-foreground-muted group-hover:text-foreground" />
                <span className="sr-only">Search</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="top"
              className="bg-background border-border h-auto"
            >
              <SheetHeader className="pb-4">
                <SheetTitle className="text-foreground font-mono">Search</SheetTitle>
              </SheetHeader>
              <div className="pb-4">
                <Suspense fallback={<SearchBarFallback />}>
                  <SearchBar onSearch={closeSearchSheet} />
                </Suspense>
              </div>
            </SheetContent>
          </Sheet>

          {/* Settings - Desktop */}
          <Link href="/settings" className="hidden lg:block">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "group hover:bg-transparent",
                pathname === "/settings" && "text-foreground"
              )}
            >
              <Settings className={cn(
                "size-5 transition-colors text-foreground-muted group-hover:text-foreground",
                pathname === "/settings" && "text-foreground"
              )} />
              <span className="sr-only">Settings</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}

export function TopNav({ className }: TopNavProps) {
  return (
    <Suspense fallback={<TopNavFallback className={className} />}>
      <TopNavInner className={className} />
    </Suspense>
  )
}

function TopNavFallback({ className }: TopNavProps) {
  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 h-14 bg-background border-b border-border z-50",
        className
      )}
    >
      <div className="h-full max-w-screen-2xl mx-auto px-4 flex items-center gap-4 relative">
        <div className="h-8 w-8 rounded bg-background-emphasis animate-pulse lg:hidden" />
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-lg bg-background-emphasis animate-pulse" />
          <div className="h-5 w-16 bg-background-emphasis animate-pulse hidden sm:block" />
        </div>
        <div className="flex-1" />
        <div className="h-8 w-8 rounded-full bg-background-emphasis animate-pulse" />
      </div>
    </header>
  )
}
