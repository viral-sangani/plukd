'use client'

import { useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AISummariesTable } from '@/components/admin/ai-summaries/ai-summaries-table'
import {
  useAdminAISummaries,
  useRegenerateAISummary,
  useBulkRegenerateMissing,
  useBulkRegenerateAll,
  useAISummariesRefreshKeyboardShortcut,
} from '@/lib/hooks'
import { toast } from 'sonner'

const PAGE_SIZE = 25

export default function AISummariesPage() {
  const [page, setPage] = useState(1)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAdminAISummaries({
    page,
    limit: PAGE_SIZE,
  })

  const regenerateAISummary = useRegenerateAISummary()
  const bulkRegenerate = useBulkRegenerateMissing()
  const bulkRegenerateAll = useBulkRegenerateAll()

  // Handle keyboard shortcut for refresh
  useAISummariesRefreshKeyboardShortcut(refetch, true)

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handleRegenerate = useCallback(async (bookmarkId: string) => {
    setRegeneratingId(bookmarkId)
    try {
      await regenerateAISummary.mutateAsync(bookmarkId)
      toast.success('AI summary regeneration started')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to regenerate AI summary'
      toast.error(message)
    } finally {
      setRegeneratingId(null)
    }
  }, [regenerateAISummary])

  const handleRefresh = useCallback(() => {
    refetch()
    toast.success('Refreshing data...')
  }, [refetch])

  const handleBulkRegenerate = useCallback(async () => {
    try {
      const result = await bulkRegenerate.mutateAsync()
      toast.success(`Queued ${result.count} missing bookmarks for AI summary regeneration`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to queue regeneration'
      toast.error(message)
    }
  }, [bulkRegenerate])

  const handleBulkRegenerateAll = useCallback(async () => {
    try {
      const result = await bulkRegenerateAll.mutateAsync()
      toast.success(`Queued ${result.count} bookmarks for full AI summary regeneration`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to queue regeneration'
      toast.error(message)
    }
  }, [bulkRegenerateAll])

  // Default empty stats and pagination for loading state
  const stats = data?.stats ?? {
    total: 0,
    withSummaries: 0,
    missing: 0,
    coveragePercent: 0,
  }

  const pagination = data?.pagination ?? {
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  }

  const bookmarks = data?.bookmarks ?? []

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-medium text-white">
            AI Summaries Health
          </h1>
          <p className="font-mono text-xs text-zinc-600 mt-1">
            Manage bookmarks with missing or incomplete AI-generated content
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBulkRegenerate}
            disabled={bulkRegenerate.isPending || stats.missing === 0}
            className="font-mono text-xs text-zinc-500 hover:text-white"
          >
            <RefreshCw className={`size-4 mr-1.5 ${bulkRegenerate.isPending ? 'animate-spin' : ''}`} />
            Regenerate Missing
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBulkRegenerateAll}
            disabled={bulkRegenerateAll.isPending || stats.total === 0}
            className="font-mono text-xs text-zinc-500 hover:text-white"
          >
            <RefreshCw className={`size-4 mr-1.5 ${bulkRegenerateAll.isPending ? 'animate-spin' : ''}`} />
            Regenerate All
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="TOTAL"
          value={stats.total.toLocaleString()}
          subValue="bookmarks"
          isLoading={isLoading}
        />
        <MetricCard
          label="WITH AI DATA"
          value={stats.withSummaries.toLocaleString()}
          subValue={`(${stats.coveragePercent.toFixed(1)}%)`}
          valueColor="text-green-500"
          isLoading={isLoading}
        />
        <MetricCard
          label="MISSING"
          value={stats.missing.toLocaleString()}
          subValue="need attention"
          valueColor={stats.missing > 0 ? 'text-amber-500' : 'text-green-500'}
          isLoading={isLoading}
        />
        <MetricCard
          label="COVERAGE"
          value={`${stats.coveragePercent.toFixed(1)}%`}
          subValue="target: 95%"
          valueColor={stats.coveragePercent >= 95 ? 'text-green-500' : 'text-amber-500'}
          isLoading={isLoading}
        />
      </div>

      {/* Error State */}
      {isError && (
        <div className="border border-red-500/20 bg-red-500/5 p-4">
          <p className="font-mono text-sm text-red-500">
            Error loading AI summaries: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="mt-2 font-mono text-xs text-red-400 hover:text-red-300"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Table */}
      {!isError && (
        <AISummariesTable
          bookmarks={bookmarks}
          stats={stats}
          pagination={pagination}
          isLoading={isLoading}
          isFetching={isFetching}
          onPageChange={handlePageChange}
          onRegenerate={handleRegenerate}
          isRegenerating={regeneratingId}
        />
      )}
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: string
  subValue?: string
  valueColor?: string
  isLoading?: boolean
}

function MetricCard({
  label,
  value,
  subValue,
  valueColor = 'text-white',
  isLoading,
}: MetricCardProps) {
  return (
    <div className="border border-zinc-900 bg-zinc-950 p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      {isLoading ? (
        <div className="animate-pulse mt-2">
          <div className="h-8 w-20 bg-zinc-900 rounded" />
          <div className="h-3 w-16 bg-zinc-900 rounded mt-1" />
        </div>
      ) : (
        <>
          <p className={`font-mono text-2xl font-medium mt-1 tabular-nums ${valueColor}`}>
            {value}
          </p>
          {subValue && (
            <p className="font-mono text-xs text-zinc-600 mt-0.5">
              {subValue}
            </p>
          )}
        </>
      )}
    </div>
  )
}
