import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '@/lib/api/client'

// Admin stats types
export interface AdminOverviewStats {
  totalBookmarks: number
  successRate: number
  successRateChange: number
  embeddingsCount: number
  embeddingsCoverage: number
  errorRate: number
  errorRateChange: number
  sourceDistribution: SourceDistribution[]
  processingStats: ProcessingStats
}

export interface SourceDistribution {
  source: string
  count: number
  percentage: number
}

export interface ProcessingStats {
  completed24h: number
  failed24h: number
  pending: number
  processing: number
  avgProcessingTime: number
}

export interface ProcessingTimeData {
  date: string
  avgTime: number
  count: number
}

async function fetchAdminStats(): Promise<AdminOverviewStats> {
  return api.get<AdminOverviewStats>('/api/admin/stats')
}

async function fetchProcessingHistory(): Promise<ProcessingTimeData[]> {
  return api.get<ProcessingTimeData[]>('/api/admin/stats/processing-history')
}

export const adminStatsQueryKey = ['admin', 'stats'] as const
export const processingHistoryQueryKey = ['admin', 'processing-history'] as const

export function useAdminStats() {
  return useQuery({
    queryKey: adminStatsQueryKey,
    queryFn: fetchAdminStats,
    staleTime: 60 * 1000, // Consider stats stale after 1 minute
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'Unauthorized') {
        return false
      }
      if (error instanceof Error && error.message === 'Forbidden: Admin access required') {
        return false
      }
      return failureCount < 2
    },
  })
}

export function useProcessingHistory() {
  return useQuery({
    queryKey: processingHistoryQueryKey,
    queryFn: fetchProcessingHistory,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'Unauthorized') {
        return false
      }
      if (error instanceof Error && error.message === 'Forbidden: Admin access required') {
        return false
      }
      return failureCount < 2
    },
  })
}

export function useRefreshAdminStats() {
  const queryClient = useQueryClient()

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
  }, [queryClient])
}

export function useAdminStatsLastUpdated() {
  const queryClient = useQueryClient()
  const state = queryClient.getQueryState(adminStatsQueryKey)

  return state?.dataUpdatedAt ? new Date(state.dataUpdatedAt) : null
}
