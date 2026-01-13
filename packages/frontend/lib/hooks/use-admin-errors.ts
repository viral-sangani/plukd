import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { Bookmark } from '@plukd/shared/types'

export interface AdminError {
  id: string
  title: string
  url: string
  source: string
  processing_error: string | null
  processing_status: string
  failed_at: string
  created_at: string
  user_id: string
}

export interface AdminErrorsResponse {
  errors: AdminError[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface UseAdminErrorsParams {
  page?: number
  limit?: number
  sortBy?: 'failed_at' | 'created_at'
  sortOrder?: 'asc' | 'desc'
}

async function fetchAdminErrors(
  params: UseAdminErrorsParams
): Promise<AdminErrorsResponse> {
  const searchParams = new URLSearchParams()

  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

  const url = `/api/admin/errors${searchParams.toString() ? `?${searchParams}` : ''}`
  return api.get<AdminErrorsResponse>(url)
}

async function retryProcessing(bookmarkId: string): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(
    `/api/admin/processing/retry/${bookmarkId}`
  )
}

export function adminErrorsQueryKey(params: UseAdminErrorsParams = {}) {
  return ['admin', 'errors', params] as const
}

export function useAdminErrors(params: UseAdminErrorsParams = {}) {
  return useQuery({
    queryKey: adminErrorsQueryKey(params),
    queryFn: () => fetchAdminErrors(params),
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

export function useRetryProcessing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: retryProcessing,
    onSuccess: () => {
      // Invalidate admin errors list to refresh
      queryClient.invalidateQueries({ queryKey: ['admin', 'errors'] })
    },
  })
}
