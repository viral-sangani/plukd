import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { api } from '@/lib/api/client'

/**
 * Types for the admin embeddings API responses
 */
export interface EmbeddingBookmark {
  id: string
  title: string
  url: string
  source: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  has_embedding: boolean
  created_at: string
  updated_at: string
}

export interface EmbeddingsStats {
  total: number
  with_embeddings: number
  missing: number
  coverage_percent: number
}

export interface EmbeddingsListResponse {
  bookmarks: EmbeddingBookmark[]
  stats: EmbeddingsStats
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface RegenerateEmbeddingResponse {
  success: boolean
  message: string
  bookmark_id: string
}

export interface BulkRegenerateResponse {
  success: boolean
  message: string
  count: number
}

export interface UseAdminEmbeddingsParams {
  page?: number
  limit?: number
  source?: string
  status?: string
}

/**
 * Query key factory for admin embeddings
 */
export function adminEmbeddingsQueryKey(params: UseAdminEmbeddingsParams = {}) {
  return ['admin', 'embeddings', params] as const
}

/**
 * Fetch embeddings list from API
 */
async function fetchEmbeddings(
  params: UseAdminEmbeddingsParams
): Promise<EmbeddingsListResponse> {
  const searchParams = new URLSearchParams()

  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.source) searchParams.set('source', params.source)
  if (params.status) searchParams.set('status', params.status)

  const url = `/api/admin/embeddings/missing${searchParams.toString() ? `?${searchParams}` : ''}`
  return api.get<EmbeddingsListResponse>(url)
}

/**
 * Regenerate embedding for a single bookmark
 */
async function regenerateEmbedding(
  bookmarkId: string
): Promise<RegenerateEmbeddingResponse> {
  return api.post<RegenerateEmbeddingResponse>(
    `/api/admin/embeddings/${bookmarkId}/regenerate`
  )
}

/**
 * Bulk regenerate embeddings for all bookmarks missing embeddings
 */
async function bulkRegenerateEmbeddings(): Promise<BulkRegenerateResponse> {
  return api.post<BulkRegenerateResponse>('/api/admin/embeddings/bulk-regenerate-queue')
}

/**
 * Bulk regenerate embeddings for ALL bookmarks (including those with existing embeddings)
 */
async function bulkRegenerateAllEmbeddings(): Promise<BulkRegenerateResponse> {
  return api.post<BulkRegenerateResponse>('/api/admin/embeddings/bulk-regenerate-all-queue')
}

/**
 * Hook to fetch admin embeddings data with pagination
 */
export function useAdminEmbeddings(params: UseAdminEmbeddingsParams = {}) {
  const query = useQuery({
    queryKey: adminEmbeddingsQueryKey(params),
    queryFn: () => fetchEmbeddings(params),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'Unauthorized') {
        return false
      }
      if (error instanceof Error && error.message.includes('403')) {
        return false
      }
      return failureCount < 2
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

/**
 * Hook to regenerate embedding for a bookmark
 */
export function useRegenerateEmbedding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: regenerateEmbedding,
    onSuccess: () => {
      // Invalidate the embeddings list to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin', 'embeddings'] })
    },
  })
}

/**
 * Hook to bulk regenerate embeddings for all bookmarks missing embeddings
 */
export function useBulkRegenerateEmbeddings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkRegenerateEmbeddings,
    onSuccess: () => {
      // Invalidate the embeddings list to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin', 'embeddings'] })
    },
  })
}

/**
 * Hook to bulk regenerate embeddings for ALL bookmarks (including those with existing embeddings)
 */
export function useBulkRegenerateAllEmbeddings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkRegenerateAllEmbeddings,
    onSuccess: () => {
      // Invalidate the embeddings list to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin', 'embeddings'] })
    },
  })
}

/**
 * Hook to handle keyboard shortcuts for refreshing
 * Press 'R' to refresh the embeddings data
 */
export function useRefreshKeyboardShortcut(
  refetch: () => void,
  enabled: boolean = true
) {
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea or if modifier keys are pressed
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        refetch()
      }
    },
    [refetch]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress, enabled])
}
