'use client'

import { Loader2, AlertCircle } from 'lucide-react'
import { StatsCard, StatsGrid } from '@/components/admin/overview/stats-card'
import {
  ProcessingChart,
  SourceDistributionChart,
} from '@/components/admin/overview/processing-chart'
import { Button } from '@/components/ui/button'
import { useAdminStats, useProcessingHistory } from '@/lib/hooks/use-admin-stats'

export default function AdminOverviewPage() {
  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
    error: statsError,
    refetch: refetchStats,
  } = useAdminStats()

  const {
    data: processingHistory,
    isLoading: isHistoryLoading,
  } = useProcessingHistory()

  const isLoading = isStatsLoading || isHistoryLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="size-5 animate-spin" />
          <span className="font-mono text-sm">Loading stats...</span>
        </div>
      </div>
    )
  }

  if (isStatsError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle className="size-5" />
          <span className="font-mono text-sm">
            {statsError instanceof Error
              ? statsError.message
              : 'Failed to load admin stats'}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchStats()}
          className="font-mono"
        >
          Try again
        </Button>
      </div>
    )
  }

  // Use mock data if API not available yet
  const statsData = stats ?? {
    totalBookmarks: 51234,
    successRate: 94.5,
    successRateChange: 0.3,
    embeddingsCount: 48234,
    embeddingsCoverage: 94.1,
    errorRate: 1.2,
    errorRateChange: -0.1,
    sourceDistribution: [
      { source: 'Twitter', count: 15234, percentage: 29.7 },
      { source: 'Instagram', count: 12456, percentage: 24.3 },
      { source: 'Web', count: 10123, percentage: 19.8 },
      { source: 'Reddit', count: 5678, percentage: 11.1 },
      { source: 'LinkedIn', count: 3456, percentage: 6.7 },
      { source: 'YouTube', count: 2345, percentage: 4.6 },
      { source: 'Other', count: 1942, percentage: 3.8 },
    ],
    processingStats: {
      completed24h: 1234,
      failed24h: 15,
      pending: 12,
      processing: 3,
      avgProcessingTime: 4.2,
    },
  }

  const historyData = processingHistory ?? [
    { date: '2026-01-05', avgTime: 3.2, count: 145 },
    { date: '2026-01-06', avgTime: 4.1, count: 178 },
    { date: '2026-01-07', avgTime: 3.8, count: 156 },
    { date: '2026-01-08', avgTime: 4.5, count: 189 },
    { date: '2026-01-09', avgTime: 3.9, count: 167 },
    { date: '2026-01-10', avgTime: 4.2, count: 198 },
    { date: '2026-01-11', avgTime: 3.7, count: 142 },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-lg font-mono font-medium text-white">Overview</h1>
        <p className="text-xs font-mono text-zinc-500 mt-1">
          System health and processing metrics
        </p>
      </div>

      {/* Stats Grid */}
      <StatsGrid>
        <StatsCard
          label="Total"
          value={statsData.totalBookmarks.toLocaleString()}
          subValue="bookmarks"
        />
        <StatsCard
          label="Success Rate"
          value={`${statsData.successRate}%`}
          change={statsData.successRateChange}
          variant="success"
        />
        <StatsCard
          label="Embeddings"
          value={statsData.embeddingsCount.toLocaleString()}
          subValue={`${statsData.embeddingsCoverage}%`}
          showWarning={statsData.embeddingsCoverage < 95}
          variant={statsData.embeddingsCoverage >= 95 ? 'success' : 'warning'}
        />
        <StatsCard
          label="Error Rate"
          value={`${statsData.errorRate}%`}
          change={statsData.errorRateChange}
          variant={statsData.errorRate > 2 ? 'error' : 'default'}
        />
      </StatsGrid>

      {/* Processing Stats */}
      <div className="grid grid-cols-5 gap-px bg-zinc-900">
        <div className="bg-[#0a0a0a] p-4">
          <span className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-zinc-500 block mb-2">
            Waiting
          </span>
          <span className="text-xl font-mono font-medium text-white tabular-nums">
            {statsData.processingStats.pending}
          </span>
          <span className="text-xs font-mono text-zinc-600 ml-1">jobs</span>
        </div>
        <div className="bg-[#0a0a0a] p-4">
          <span className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-zinc-500 block mb-2">
            Active
          </span>
          <span className="text-xl font-mono font-medium text-amber-500 tabular-nums">
            {statsData.processingStats.processing}
          </span>
          <span className="text-xs font-mono text-zinc-600 ml-1">
            processing
          </span>
        </div>
        <div className="bg-[#0a0a0a] p-4">
          <span className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-zinc-500 block mb-2">
            Completed
          </span>
          <span className="text-xl font-mono font-medium text-green-500 tabular-nums">
            {statsData.processingStats.completed24h.toLocaleString()}
          </span>
          <span className="text-xs font-mono text-zinc-600 ml-1">(24h)</span>
        </div>
        <div className="bg-[#0a0a0a] p-4">
          <span className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-zinc-500 block mb-2">
            Failed
          </span>
          <span className="text-xl font-mono font-medium text-red-500 tabular-nums">
            {statsData.processingStats.failed24h}
          </span>
          <span className="text-xs font-mono text-zinc-600 ml-1">(24h)</span>
        </div>
        <div className="bg-[#0a0a0a] p-4">
          <span className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-zinc-500 block mb-2">
            Avg Time
          </span>
          <span className="text-xl font-mono font-medium text-white tabular-nums">
            {statsData.processingStats.avgProcessingTime.toFixed(1)}s
          </span>
          <span className="text-xs font-mono text-zinc-600 ml-1">median</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProcessingChart data={historyData} />
        <SourceDistributionChart data={statsData.sourceDistribution} />
      </div>
    </div>
  )
}
