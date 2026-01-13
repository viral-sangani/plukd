import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { ProcessingStatus, ContentSource } from '@plukd/shared/types'

export interface AdminProcessingJob {
  id: string
  title: string
  url: string
  source: ContentSource
  processing_status: ProcessingStatus
  processing_error: string | null
  created_at: string
  updated_at: string
  user_id: string
}

export interface AdminProcessingResponse {
  jobs: AdminProcessingJob[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface UseAdminProcessingParams {
  page?: number
  limit?: number
  status?: ProcessingStatus
  sortBy?: 'created_at' | 'updated_at'
  sortOrder?: 'asc' | 'desc'
}

async function fetchAdminProcessing(
  params: UseAdminProcessingParams
): Promise<AdminProcessingResponse> {
  const searchParams = new URLSearchParams()

  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.status) searchParams.set('status', params.status)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

  const url = `/api/admin/processing${searchParams.toString() ? `?${searchParams}` : ''}`
  return api.get<AdminProcessingResponse>(url)
}

async function reprocessBookmark(bookmarkId: string): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(
    `/api/admin/processing/${bookmarkId}/reprocess`
  )
}

export function adminProcessingQueryKey(params: UseAdminProcessingParams = {}) {
  return ['admin', 'processing', params] as const
}

export function useAdminProcessing(params: UseAdminProcessingParams = {}) {
  return useQuery({
    queryKey: adminProcessingQueryKey(params),
    queryFn: () => fetchAdminProcessing(params),
    staleTime: 60 * 1000, // 1 minute
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
}

export function useReprocessBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: reprocessBookmark,
    onSuccess: () => {
      // Invalidate processing list to refresh
      queryClient.invalidateQueries({ queryKey: ['admin', 'processing'] })
      // Also invalidate stats since processing counts may have changed
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })
}
