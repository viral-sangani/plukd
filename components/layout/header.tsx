"use client"

import Link from "next/link"
import Image from "next/image"
import { Search, Settings, LogOut } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUser } from "@/lib/hooks"

export function Header() {
  const { data: user, isLoading } = useUser()

  const handleSignOut = async () => {
    try {
      // Use the server-side signout API route to properly clear cookies
      // and redirect. This avoids race conditions with client-side signout.
      const form = document.createElement("form")
      form.method = "POST"
      form.action = "/api/auth/signout"
      document.body.appendChild(form)
      form.submit()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  const getDisplayName = (name: string | null | undefined, email: string | undefined) => {
    if (name) {
      return name.length > 20 ? name.slice(0, 20) + "..." : name
    }
    if (email) {
      return email.length > 20 ? email.slice(0, 20) + "..." : email
    }
    return "User"
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#1c1917] border-b border-[#44403c]">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icon.png"
              alt="Plukd"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-cal text-xl tracking-tight text-[#fafaf9]">
              Plukd
            </span>
          </Link>
        </div>

        {/* Center: Search bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#78716c]" />
            <Input
              type="search"
              placeholder="Search bookmarks..."
              className="w-full pl-10 bg-[#292524] border-[#44403c] placeholder:text-[#78716c] focus-visible:border-[#fafaf9] focus-visible:ring-[#fafaf9]/20"
            />
          </div>
        </div>

        {/* Right: User avatar dropdown */}
        <div className="flex items-center gap-2">
          {/* Mobile search button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-[#a8a29e] hover:text-[#fafaf9] hover:bg-[#292524]"
          >
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 rounded-full hover:bg-[#292524] px-2 gap-2"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={user?.avatar_url || ""} alt={user?.name || "User"} />
                  <AvatarFallback className="bg-[#292524] text-[#a8a29e] text-sm">
                    {isLoading ? "..." : getInitials(user?.name || null, user?.email || "U")}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm font-medium text-[#a8a29e] max-w-[150px] truncate">
                  {isLoading ? "" : getDisplayName(user?.name, user?.email)}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-[#1c1917] border-[#44403c]"
            >
              <DropdownMenuLabel className="text-[#fafaf9]">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.name || "User"}</p>
                  <p className="text-xs text-[#78716c] truncate">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#44403c]" />
              <DropdownMenuItem asChild className="text-[#a8a29e] focus:text-[#fafaf9] focus:bg-[#292524] cursor-pointer">
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#44403c]" />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-[#a8a29e] focus:text-[#fafaf9] focus:bg-[#292524] cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
