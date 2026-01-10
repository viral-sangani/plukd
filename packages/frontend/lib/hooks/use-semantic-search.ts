import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { ContentSource, Category, ContentType } from '@plukd/shared/types'

/**
 * Semantic search result from the API
 */
export interface SemanticSearchResult {
  id: string
  url: string
  title: string
  source: ContentSource
  author: string | null
  blurb: string
  category: Category
  tags: string[]
  content_type: ContentType | null
  created_at: string
  similarity: number
}

/**
 * Semantic search response from the API
 */
export interface SemanticSearchResponse {
  query: string
  results: SemanticSearchResult[]
  count: number
}

/**
 * Semantic search parameters
 */
export interface UseSemanticSearchParams {
  query: string
  limit?: number
  threshold?: number
  includeArchived?: boolean
}

async function fetchSemanticSearch(
  params: UseSemanticSearchParams
): Promise<SemanticSearchResponse> {
  const searchParams = new URLSearchParams()

  searchParams.set('q', params.query)
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.threshold) searchParams.set('threshold', params.threshold.toString())
  if (params.includeArchived) searchParams.set('includeArchived', 'true')

  const url = `/api/bookmarks/search/semantic?${searchParams}`
  return api.get<SemanticSearchResponse>(url)
}

/**
 * Query key for semantic search
 */
export function semanticSearchQueryKey(params: UseSemanticSearchParams) {
  return ['semanticSearch', params] as const
}

/**
 * Hook for semantic search of bookmarks.
 *
 * Uses AI-generated embeddings to find bookmarks by meaning rather than keywords.
 * For example, "find that article about scaling databases" will find relevant
 * bookmarks even without exact keyword matches.
 *
 * @param query - The search query (min 2 characters)
 * @param options - Search options (limit, threshold, includeArchived)
 * @returns Query result with semantic search results
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useSemanticSearch({
 *   query: 'scaling databases',
 *   limit: 10,
 * })
 *
 * if (data) {
 *   console.log(`Found ${data.count} results`)
 *   data.results.forEach(r => console.log(`${r.title} (${r.similarity})`))
 * }
 * ```
 */
export function useSemanticSearch(params: UseSemanticSearchParams) {
  const enabled = params.query.length >= 2

  return useQuery({
    queryKey: semanticSearchQueryKey(params),
    queryFn: () => fetchSemanticSearch(params),
    enabled,
    staleTime: 60 * 1000, // Cache results for 1 minute
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

/**
 * Check if semantic search is available (embeddings have been generated).
 * Returns true if at least one result can be returned for a simple query.
 */
export function useSemanticSearchAvailable() {
  return useQuery({
    queryKey: ['semanticSearchAvailable'],
    queryFn: async () => {
      try {
        const result = await fetchSemanticSearch({ query: 'test', limit: 1 })
        return { available: true, count: result.count }
      } catch {
        return { available: false, count: 0 }
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false,
  })
}
