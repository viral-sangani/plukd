'use client'

import { Plus, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookmarkTable } from '@/components/bookmarks/bookmark-table'
import { useBookmarks } from '@/lib/hooks'
import type { Bookmark } from '@/types'

export default function DashboardPage() {
  // Fetch bookmarks from API
  const { data, isLoading, isError, error, refetch } = useBookmarks()

  // Use API data - don't fall back to mock data so we see real state
  const bookmarks: Bookmark[] = data?.bookmarks ?? []

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6 p-4 lg:p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-cal text-2xl tracking-tight text-[#fafafa]">
          Bookmarks
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              refetch()
              // Dispatch event to update sidebar counts
              window.dispatchEvent(new Event('bookmarks-updated'))
            }}
            disabled={isLoading}
            title="Refresh bookmarks"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            className="bg-[#fafafa] text-[#09090b] hover:bg-[#a1a1aa] font-medium"
          >
            <Plus className="size-4" />
            Add Bookmark
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-[#a1a1aa]" />
          <span className="ml-2 text-[#a1a1aa]">Loading bookmarks...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertCircle className="size-8 text-red-500" />
            <p className="text-[#a1a1aa]">
              {error instanceof Error ? error.message : 'Failed to load bookmarks'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-2"
            >
              <RefreshCw className="size-4 mr-2" />
              Try again
            </Button>
          </div>
        </div>
      )}

      {/* Bookmarks Table (handles its own empty state) */}
      {!isLoading && !isError && <BookmarkTable bookmarks={bookmarks} />}
    </div>
  )
}
