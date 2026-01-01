import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { api } from '@/lib/api/client'
import type { Bookmark } from '@plukd/shared/types'

async function fetchBookmark(id: string): Promise<Bookmark> {
  return api.get<Bookmark>(`/api/bookmarks/${id}`)
}

export function bookmarkQueryKey(id: string) {
  return ['bookmark', id] as const
}

export function useBookmark(id: string) {
  return useQuery({
    queryKey: bookmarkQueryKey(id),
    queryFn: () => fetchBookmark(id),
    staleTime: 60 * 1000, // Consider bookmark stale after 1 minute
    enabled: Boolean(id), // Only fetch if id is provided
    retry: (failureCount, error) => {
      // Don't retry on authentication or not found errors
      if (error instanceof Error) {
        if (
          error.message === 'Unauthorized' ||
          error.message === 'Not found'
        ) {
          return false
        }
      }
      return failureCount < 2
    },
  })
}

/**
 * Hook to prefetch a single bookmark on hover.
 * Returns a function that can be called with a bookmark ID to prefetch its details.
 * Includes a 100ms delay to avoid unnecessary prefetches on quick mouse movements.
 *
 * @example
 * const prefetchBookmark = usePrefetchBookmark()
 *
 * <tr onMouseEnter={() => prefetchBookmark(bookmark.id)}>
 */
export function usePrefetchBookmark() {
  const queryClient = useQueryClient()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPrefetchedIdRef = useRef<string | null>(null)

  const prefetch = useCallback(
    (id: string) => {
      // Skip if we've already prefetched this bookmark recently
      if (lastPrefetchedIdRef.current === id) {
        return
      }

      // Clear any pending prefetch
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Delay prefetch by 100ms to avoid unnecessary fetches on quick mouse movements
      timeoutRef.current = setTimeout(() => {
        // Check if data is already in cache and not stale
        const existingData = queryClient.getQueryData<Bookmark>(
          bookmarkQueryKey(id)
        )
        const queryState = queryClient.getQueryState(bookmarkQueryKey(id))

        // Skip prefetch if data exists and is not stale
        if (existingData && queryState && !queryState.isInvalidated) {
          const dataAge = Date.now() - (queryState.dataUpdatedAt || 0)
          if (dataAge < 60 * 1000) {
            // Within staleTime
            return
          }
        }

        lastPrefetchedIdRef.current = id

        queryClient.prefetchQuery({
          queryKey: bookmarkQueryKey(id),
          queryFn: () => fetchBookmark(id),
          staleTime: 60 * 1000,
        })
      }, 100)
    },
    [queryClient]
  )

  const cancelPrefetch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  return { prefetch, cancelPrefetch }
}
