import { useQuery } from '@tanstack/react-query'
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
