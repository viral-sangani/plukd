'use client'

import * as React from 'react'
import { useAdminErrors, useRetryProcessing } from '@/lib/hooks/use-admin-errors'
import { ErrorsTable } from '@/components/admin/errors'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_LIMIT = 25

export default function AdminErrorsPage() {
  const [page, setPage] = React.useState(1)
  const [retryingId, setRetryingId] = React.useState<string | null>(null)

  const { data, isLoading, error, refetch, isFetching } = useAdminErrors({
    page,
    limit: PAGE_LIMIT,
    sortBy: 'updated_at',
    sortOrder: 'desc',
  })

  const retryMutation = useRetryProcessing()

  // Keyboard shortcut for refresh
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not in an input field
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        refetch()
        toast.info('Refreshing errors...')
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [refetch])

  const handleRetry = async (bookmarkId: string) => {
    setRetryingId(bookmarkId)
    try {
      await retryMutation.mutateAsync(bookmarkId)
      toast.success('Processing retry triggered')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to retry processing'
      toast.error(message)
    } finally {
      setRetryingId(null)
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleRefresh = () => {
    refetch()
    toast.info('Refreshing errors...')
  }

  // Format last updated time
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)
  React.useEffect(() => {
    if (!isLoading && !isFetching) {
      setLastUpdated(new Date())
    }
  }, [isLoading, isFetching])

  const formatLastUpdated = () => {
    if (!lastUpdated) return ''
    const now = new Date()
    const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)} minute${Math.floor(diff / 60) > 1 ? 's' : ''} ago`
    return lastUpdated.toLocaleTimeString()
  }

  // Update the "last updated" display every minute
  React.useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated((prev) => prev ? new Date(prev.getTime()) : null)
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-7xl mx-auto">
          <div className="border border-red-500/30 bg-red-500/10 rounded-none p-6 text-center">
            <AlertCircle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="font-mono text-sm text-red-400">
              {error instanceof Error ? error.message : 'Failed to load errors'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-4 font-mono text-xs"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-mono text-2xl font-semibold text-white">
              Processing Errors
            </h1>
            <p className="font-mono text-sm text-gray-500 mt-1">
              Failed bookmark processing attempts
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              {lastUpdated && (
                <p className="font-mono text-xs text-gray-500">
                  Last updated: {formatLastUpdated()}
                </p>
              )}
              <p className="font-mono text-xs text-gray-600">
                Keyboard: R
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="font-mono text-xs h-9 px-4"
            >
              {isFetching ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  <span className="ml-2">Refresh</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Errors Table */}
        <ErrorsTable
          errors={data?.errors || []}
          isLoading={isLoading}
          page={page}
          totalPages={data?.pagination.totalPages || 1}
          total={data?.pagination.total || 0}
          onPageChange={handlePageChange}
          onRetry={handleRetry}
          isRetrying={retryingId}
        />
      </div>
    </div>
  )
}
