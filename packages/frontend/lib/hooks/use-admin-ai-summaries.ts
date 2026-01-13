import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { api } from '@/lib/api/client'

/**
 * Types for the admin AI summaries API responses
 */
export interface AISummaryBookmark {
  id: string
  title: string
  url: string
  source: string
  category: string | null
  tags: string[] | null
  blurb: string | null
  summary: string | null
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface AISummariesStats {
  total: number
  withSummaries: number
  missing: number
  coveragePercent: number
}

export interface AISummariesListResponse {
  bookmarks: AISummaryBookmark[]
  stats: AISummariesStats
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface RegenerateAISummaryResponse {
  success: boolean
  message: string
  bookmark_id: string
}

export interface BulkRegenerateResponse {
  success: boolean
  message: string
  count: number
}

export interface UseAdminAISummariesParams {
  page?: number
  limit?: number
  source?: string
  status?: string
}

/**
 * Query key factory for admin AI summaries
 */
export function adminAISummariesQueryKey(params: UseAdminAISummariesParams = {}) {
  return ['admin', 'ai-summaries', params] as const
}

/**
 * Fetch AI summaries list from API
 */
async function fetchAISummaries(
  params: UseAdminAISummariesParams
): Promise<AISummariesListResponse> {
  const searchParams = new URLSearchParams()

  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.source) searchParams.set('source', params.source)
  if (params.status) searchParams.set('status', params.status)

  const url = `/api/admin/ai-summaries/missing${searchParams.toString() ? `?${searchParams}` : ''}`
  return api.get<AISummariesListResponse>(url)
}

/**
 * Regenerate AI summary for a single bookmark
 */
async function regenerateAISummary(
  bookmarkId: string
): Promise<RegenerateAISummaryResponse> {
  return api.post<RegenerateAISummaryResponse>(
    `/api/admin/ai-summaries/${bookmarkId}/regenerate`
  )
}

/**
 * Bulk regenerate AI summaries for all bookmarks missing summaries
 */
async function bulkRegenerateMissing(): Promise<BulkRegenerateResponse> {
  return api.post<BulkRegenerateResponse>('/api/admin/ai-summaries/bulk-regenerate-queue')
}

/**
 * Bulk regenerate AI summaries for ALL bookmarks (including those with existing summaries)
 */
async function bulkRegenerateAll(): Promise<BulkRegenerateResponse> {
  return api.post<BulkRegenerateResponse>('/api/admin/ai-summaries/bulk-regenerate-all-queue')
}

/**
 * Hook to fetch admin AI summaries data with pagination
 */
export function useAdminAISummaries(params: UseAdminAISummariesParams = {}) {
  const query = useQuery({
    queryKey: adminAISummariesQueryKey(params),
    queryFn: () => fetchAISummaries(params),
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
 * Hook to regenerate AI summary for a single bookmark
 */
export function useRegenerateAISummary() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: regenerateAISummary,
    onSuccess: () => {
      // Invalidate the AI summaries list to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-summaries'] })
    },
  })
}

/**
 * Hook to bulk regenerate AI summaries for all bookmarks missing summaries
 */
export function useBulkRegenerateMissing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkRegenerateMissing,
    onSuccess: () => {
      // Invalidate the AI summaries list to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-summaries'] })
    },
  })
}

/**
 * Hook to bulk regenerate AI summaries for ALL bookmarks (including those with existing summaries)
 */
export function useBulkRegenerateAll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkRegenerateAll,
    onSuccess: () => {
      // Invalidate the AI summaries list to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-summaries'] })
    },
  })
}

/**
 * Hook to handle keyboard shortcuts for refreshing
 * Press 'R' to refresh the AI summaries data
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
