'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2 } from 'lucide-react'
import { AdminSidebar } from '@/components/admin/layout/sidebar'
import { Button } from '@/components/ui/button'
import { useAdminStats, useRefreshAdminStats, useAdminStatsLastUpdated } from '@/lib/hooks/use-admin-stats'
import { useUser } from '@/lib/hooks'
import { formatRelativeTime } from '@/lib/utils'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()
  const { isLoading: isUserLoading, isError: isUserError } = useUser()
  const { isError: isStatsError, error: statsError } = useAdminStats()
  const refreshStats = useRefreshAdminStats()
  const lastUpdated = useAdminStatsLastUpdated()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdatedText, setLastUpdatedText] = useState<string | null>(null)

  // Check if user is not admin based on 403 error from stats API
  const isNotAdmin = isStatsError && statsError instanceof Error &&
    statsError.message === 'Forbidden: Admin access required'

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    refreshStats()
    // Give visual feedback for at least 500ms
    setTimeout(() => setIsRefreshing(false), 500)
  }, [refreshStats])

  // Update last updated text periodically
  useEffect(() => {
    const updateText = () => {
      if (lastUpdated) {
        setLastUpdatedText(formatRelativeTime(lastUpdated))
      }
    }

    updateText()
    const interval = setInterval(updateText, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [lastUpdated])

  // Handle refresh with "R" key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        handleRefresh()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleRefresh])

  // Show loading state while checking auth
  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="size-5 animate-spin" />
          <span className="font-mono text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (isUserError) {
    router.push('/login')
    return null
  }

  // Redirect to home if not admin (403 from admin API)
  if (isNotAdmin) {
    router.push('/')
    return null
  }

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <AdminSidebar className="fixed left-0 top-0 bottom-0" />

      {/* Main content */}
      <div className="flex-1 ml-56">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-sm border-b border-zinc-900">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              {lastUpdatedText && (
                <span className="text-[10px] font-mono text-zinc-600">
                  Last updated: {lastUpdatedText}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-600">
                Keyboard:{' '}
                <kbd className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 font-mono text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 rounded">
                  R
                </kbd>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="text-zinc-500 hover:text-white"
              >
                <RefreshCw
                  className={`size-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                <span className="font-mono text-xs">Refresh</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
