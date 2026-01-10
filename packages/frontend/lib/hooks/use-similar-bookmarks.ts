import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { Bookmark } from '@plukd/shared'

/**
 * Similar bookmarks response from the API
 */
export interface SimilarBookmarksResponse {
  results: Bookmark[]
  count: number
}

/**
 * Parameters for fetching similar bookmarks
 */
export interface UseSimilarBookmarksParams {
  bookmarkId: string
  limit?: number
  threshold?: number
}

async function fetchSimilarBookmarks(
  params: UseSimilarBookmarksParams
): Promise<SimilarBookmarksResponse> {
  const searchParams = new URLSearchParams()

  searchParams.set('excludeId', params.bookmarkId)
  searchParams.set('limit', (params.limit ?? 5).toString())
  searchParams.set('threshold', (params.threshold ?? 0.7).toString())
  searchParams.set('includeArchived', 'false')

  const url = `/api/bookmarks/${params.bookmarkId}/similar?${searchParams}`
  return api.get<SimilarBookmarksResponse>(url)
}

/**
 * Query key for similar bookmarks
 */
export function similarBookmarksQueryKey(params: UseSimilarBookmarksParams) {
  return ['similarBookmarks', params.bookmarkId, params] as const
}

/**
 * Hook for fetching similar bookmarks based on semantic similarity.
 *
 * Finds bookmarks that are semantically related to the given bookmark
 * using AI-generated embeddings. Useful for discovering related content.
 *
 * @param bookmarkId - The ID of the bookmark to find similar bookmarks for
 * @param options - Search options (limit, threshold)
 * @returns Query result with similar bookmarks
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useSimilarBookmarks({
 *   bookmarkId: '123',
 *   limit: 5,
 * })
 *
 * if (data) {
 *   console.log(`Found ${data.count} similar bookmarks`)
 *   data.results.forEach(b => console.log(`${b.title} (${b.similarity})`))
 * }
 * ```
 */
export function useSimilarBookmarks(params: UseSimilarBookmarksParams) {
  return useQuery({
    queryKey: similarBookmarksQueryKey(params),
    queryFn: () => fetchSimilarBookmarks(params),
    staleTime: 5 * 60 * 1000, // Cache results for 5 minutes
    enabled: !!params.bookmarkId,
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error instanceof Error && error.message === 'Unauthorized') {
        return false
      }
      // Don't retry if semantic search is unavailable (503)
      if (error instanceof Error && error.message.includes('503')) {
        return false
      }
      return failureCount < 2
    },
  })
}
