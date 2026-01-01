'use client'

import { useState, useCallback } from 'react'
import { Plus, Loader2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookmarkTable } from '@/components/bookmarks/bookmark-table'
import { AddBookmarkDialog } from '@/components/bookmarks/add-bookmark-dialog'
import { useBookmarks } from '@/lib/hooks'
import type { Bookmark } from '@plukd/shared'

export default function DashboardPage() {
  // Fetch bookmarks from API
  const { data, isLoading, isError, error, refetch } = useBookmarks()

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const handleSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids)
  }, [])

  // Use API data - don't fall back to mock data so we see real state
  const bookmarks: Bookmark[] = data?.bookmarks ?? []

  const selectedCount = selectedIds.size

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6 p-4 lg:p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted">
            Bookmarks
          </h1>
          {selectedCount > 0 && (
            <span className="text-[10px] font-mono font-medium text-foreground-muted">
              ({selectedCount} selected)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="group"
            onClick={() => {
              refetch()
              // Dispatch event to update sidebar counts
              window.dispatchEvent(new Event('bookmarks-updated'))
            }}
            disabled={isLoading}
            title="Refresh bookmarks"
          >
            <RefreshCw className={`size-4 transition-colors text-foreground-muted group-hover:text-foreground ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          {selectedCount > 0 && (
            <Button
              variant="outline"
              className="font-medium text-red-400 border-red-900/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          )}
          <Button
            variant="default"
            className="font-medium"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="size-4" />
            Add Bookmark
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-foreground-muted" />
          <span className="ml-2 text-foreground-muted font-mono text-sm">Loading bookmarks...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertCircle className="size-8 text-red-500" />
            <p className="text-foreground-muted font-mono text-sm">
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
      {!isLoading && !isError && (
        <BookmarkTable
          bookmarks={bookmarks}
          onSelectionChange={handleSelectionChange}
          isDeleteDialogOpen={isDeleteDialogOpen}
          onDeleteDialogOpenChange={setIsDeleteDialogOpen}
        />
      )}

      {/* Add Bookmark Dialog */}
      <AddBookmarkDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => refetch()}
      />
    </div>
  )
}
