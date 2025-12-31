import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Bookmark, BookmarkListResponse, ProcessingStatus } from '@/types'

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
  const response = await fetch(url)

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized')
    }
    throw new Error('Failed to fetch bookmarks')
  }

  return response.json()
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
