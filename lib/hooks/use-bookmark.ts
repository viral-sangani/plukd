import { useQuery } from '@tanstack/react-query'
import type { Bookmark } from '@/types'

async function fetchBookmark(id: string): Promise<Bookmark> {
  const response = await fetch(`/api/bookmarks/${id}`)

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized')
    }
    if (response.status === 404) {
      throw new Error('Bookmark not found')
    }
    throw new Error('Failed to fetch bookmark')
  }

  return response.json()
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
          error.message === 'Bookmark not found'
        ) {
          return false
        }
      }
      return failureCount < 2
    },
  })
}
