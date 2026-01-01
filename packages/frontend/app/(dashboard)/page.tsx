'use client'

import { useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Loader2, AlertCircle, RefreshCw, Trash2, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookmarkTable } from '@/components/bookmarks/bookmark-table'
import { BookmarkFilters } from '@/components/bookmarks/bookmark-filters'
import { AddBookmarkDialog } from '@/components/bookmarks/add-bookmark-dialog'
import { useBookmarks } from '@/lib/hooks'
import type { Bookmark, Category, ContentSource, ProcessingStatus } from '@plukd/shared'

const VALID_SOURCES: ContentSource[] = ['twitter', 'reddit', 'linkedin', 'youtube', 'web']

function isValidSource(value: string | null): value is ContentSource {
  return value !== null && VALID_SOURCES.includes(value as ContentSource)
}

function DashboardPageFallback() {
  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted">
              Bookmarks
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-background-emphasis animate-pulse" />
            <div className="h-8 w-28 rounded bg-background-emphasis animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-64 rounded bg-background-emphasis animate-pulse" />
      </div>
      <div className="flex flex-1 items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-foreground-muted" />
        <span className="ml-2 text-foreground-muted font-mono text-sm">Loading bookmarks...</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <DashboardPageContent />
    </Suspense>
  )
}

function DashboardPageContent() {
  // Get search query and source from URL params (set by navbar)
  const searchParams = useSearchParams()
  const router = useRouter()
  const searchQuery = searchParams.get('search') || ''
  const sourceParam = searchParams.get('source')

  // Derive source filter from URL - no state needed for URL-synced values
  const urlSource = isValidSource(sourceParam) ? sourceParam : null

  // Filter state for non-URL filters
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<ProcessingStatus | null>(null)

  // Fetch bookmarks from API with search query and filters
  const { data, isLoading, isFetching, isError, error, refetch } = useBookmarks({
    search: searchQuery || undefined,
    category: selectedCategory ?? undefined,
    source: urlSource ?? undefined,
    status: selectedStatus ?? undefined,
  })

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const handleSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids)
  }, [])

  const handleClearAllFilters = useCallback(() => {
    setSelectedCategory(null)
    setSelectedStatus(null)
    // Also clear source from URL if present
    const params = new URLSearchParams(searchParams.toString())
    if (params.has('source')) {
      params.delete('source')
      router.push(`/?${params.toString()}`)
    }
  }, [router, searchParams])

  const handleClearSearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('search')
    router.push(`/?${params.toString()}`)
  }, [router, searchParams])

  const handleSourceChange = useCallback((source: ContentSource | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (source) {
      params.set('source', source)
    } else {
      params.delete('source')
    }
    router.push(`/?${params.toString()}`)
  }, [router, searchParams])

  // Use API data - don't fall back to mock data so we see real state
  const bookmarks: Bookmark[] = data?.bookmarks ?? []

  const selectedCount = selectedIds.size
  const hasFilters = selectedCategory !== null || urlSource !== null || selectedStatus !== null
  const hasSearchOrFilters = searchQuery || hasFilters

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6 p-4 lg:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4">
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
            {hasSearchOrFilters && data?.pagination && (
              <span className="text-[10px] font-mono font-medium text-foreground-muted">
                ({data.pagination.total} results)
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
              disabled={isFetching}
              title="Refresh bookmarks"
            >
              <RefreshCw className={`size-4 transition-colors text-foreground-muted group-hover:text-foreground ${isFetching ? 'animate-spin' : ''}`} />
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

        {/* Filters Row */}
        <div className="flex items-start">
          <BookmarkFilters
            selectedCategory={selectedCategory}
            selectedSource={urlSource}
            selectedStatus={selectedStatus}
            onCategoryChange={setSelectedCategory}
            onSourceChange={handleSourceChange}
            onStatusChange={setSelectedStatus}
            onClearAll={handleClearAllFilters}
          />
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
          emptyComponent={
            hasSearchOrFilters ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 px-4 text-center">
                <div className="mb-4 flex items-center justify-center size-12 rounded-full bg-[#18181b]">
                  <SearchX className="size-6 text-[#71717a]" />
                </div>
                <p className="text-[#fafafa] text-base font-medium font-mono mb-2">
                  No results found
                </p>
                <p className="text-[#a1a1aa] text-sm max-w-sm">
                  {searchQuery && hasFilters
                    ? `No bookmarks match "${searchQuery}" with the selected filters.`
                    : searchQuery
                      ? `No bookmarks match "${searchQuery}".`
                      : 'No bookmarks match the selected filters.'}
                </p>
                <div className="flex gap-2 mt-4">
                  {searchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearSearch}
                    >
                      Clear search
                    </Button>
                  )}
                  {hasFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearAllFilters}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>
            ) : undefined
          }
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
