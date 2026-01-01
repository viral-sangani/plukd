import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { api } from '@/lib/api/client'
import type { Bookmark, BookmarkListResponse, ProcessingStatus } from '@plukd/shared/types'

export interface UseBookmarksParams {
  page?: number
  limit?: number
  category?: string
  tags?: string[]
  source?: string
  search?: string
  status?: ProcessingStatus
  sortBy?: 'created_at' | 'title'
  sortOrder?: 'asc' | 'desc'
}

async function fetchBookmarks(
  params: UseBookmarksParams
): Promise<BookmarkListResponse> {
  const searchParams = new URLSearchParams()

  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.category) searchParams.set('category', params.category)
  if (params.tags && params.tags.length > 0) {
    searchParams.set('tags', params.tags.join(','))
  }
  if (params.source) searchParams.set('source', params.source)
  if (params.search) searchParams.set('search', params.search)
  if (params.status) searchParams.set('status', params.status)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

  const url = `/api/bookmarks${searchParams.toString() ? `?${searchParams}` : ''}`
  return api.get<BookmarkListResponse>(url)
}

export function bookmarksQueryKey(params: UseBookmarksParams = {}) {
  return ['bookmarks', params] as const
}

export function useBookmarks(params: UseBookmarksParams = {}) {
  return useQuery({
    queryKey: bookmarksQueryKey(params),
    queryFn: () => fetchBookmarks(params),
    staleTime: 30 * 1000, // Consider bookmarks stale after 30 seconds
    // Refetch when window regains focus (bookmarks can be added via Telegram)
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error instanceof Error && error.message === 'Unauthorized') {
        return false
      }
      return failureCount < 2
    },
  })
}

// Hook to prefetch bookmarks for a different page
export function usePrefetchBookmarks() {
  const queryClient = useQueryClient()

  return (params: UseBookmarksParams) => {
    queryClient.prefetchQuery({
      queryKey: bookmarksQueryKey(params),
      queryFn: () => fetchBookmarks(params),
      staleTime: 30 * 1000,
    })
  }
}

/**
 * Hook to prefetch the next page of bookmarks when user scrolls near the bottom.
 * Automatically prefetches the next page when the scroll threshold is reached.
 *
 * @param currentParams - Current query parameters including page number
 * @param totalPages - Total number of pages available
 * @param scrollThreshold - Percentage of scroll position to trigger prefetch (0-1, default 0.75)
 *
 * @example
 * const { scrollContainerRef } = usePrefetchNextPage(
 *   { page: currentPage, limit: 10 },
 *   totalPages
 * )
 *
 * <div ref={scrollContainerRef}>...</div>
 */
export function usePrefetchNextPage(
  currentParams: UseBookmarksParams,
  totalPages: number,
  scrollThreshold = 0.75
) {
  const queryClient = useQueryClient()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const hasPrefetchedRef = useRef(false)
  const currentPage = currentParams.page || 1

  const prefetchNextPage = useCallback(() => {
    const nextPage = currentPage + 1

    // Don't prefetch if we're on the last page or already prefetched
    if (nextPage > totalPages || hasPrefetchedRef.current) {
      return
    }

    const nextPageParams = { ...currentParams, page: nextPage }

    // Check if next page is already cached
    const existingData = queryClient.getQueryData<BookmarkListResponse>(
      bookmarksQueryKey(nextPageParams)
    )

    if (existingData) {
      return
    }

    hasPrefetchedRef.current = true

    queryClient.prefetchQuery({
      queryKey: bookmarksQueryKey(nextPageParams),
      queryFn: () => fetchBookmarks(nextPageParams),
      staleTime: 30 * 1000,
    })
  }, [queryClient, currentParams, currentPage, totalPages])

  // Reset prefetch flag when page changes
  useEffect(() => {
    hasPrefetchedRef.current = false
  }, [currentPage])

  // Set up scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

      if (scrollPercentage >= scrollThreshold) {
        prefetchNextPage()
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [prefetchNextPage, scrollThreshold])

  // Also prefetch when near the end based on current data
  const prefetchIfNearEnd = useCallback(
    (visibleItemIndex: number, totalItems: number) => {
      // Prefetch when viewing items in the last 25% of the list
      if (totalItems > 0 && visibleItemIndex / totalItems >= scrollThreshold) {
        prefetchNextPage()
      }
    },
    [prefetchNextPage, scrollThreshold]
  )

  return {
    scrollContainerRef,
    prefetchNextPage,
    prefetchIfNearEnd,
  }
}

/**
 * Hook to prefetch adjacent pages (previous and next) for smoother pagination.
 * Useful when using traditional pagination controls.
 *
 * @param currentParams - Current query parameters including page number
 * @param totalPages - Total number of pages available
 *
 * @example
 * usePrefetchAdjacentPages({ page: currentPage, limit: 10 }, totalPages)
 */
export function usePrefetchAdjacentPages(
  currentParams: UseBookmarksParams,
  totalPages: number
) {
  const queryClient = useQueryClient()
  const currentPage = currentParams.page || 1

  useEffect(() => {
    const pagesToPrefetch: number[] = []

    // Prefetch next page if available
    if (currentPage < totalPages) {
      pagesToPrefetch.push(currentPage + 1)
    }

    // Prefetch previous page if available (for back navigation)
    if (currentPage > 1) {
      pagesToPrefetch.push(currentPage - 1)
    }

    pagesToPrefetch.forEach((page) => {
      const pageParams = { ...currentParams, page }

      // Check if page is already cached
      const existingData = queryClient.getQueryData<BookmarkListResponse>(
        bookmarksQueryKey(pageParams)
      )

      if (!existingData) {
        queryClient.prefetchQuery({
          queryKey: bookmarksQueryKey(pageParams),
          queryFn: () => fetchBookmarks(pageParams),
          staleTime: 30 * 1000,
        })
      }
    })
  }, [queryClient, currentParams, currentPage, totalPages])
}

// Helper to get optimistic update data
export function getOptimisticBookmarkUpdate(
  bookmarks: Bookmark[],
  bookmarkId: string,
  updates: Partial<Bookmark>
): Bookmark[] {
  return bookmarks.map((bookmark) =>
    bookmark.id === bookmarkId ? { ...bookmark, ...updates } : bookmark
  )
}
