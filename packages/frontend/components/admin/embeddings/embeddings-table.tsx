'use client'

import { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { RefreshCw, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime, truncateText } from '@/lib/utils'
import type { EmbeddingBookmark, EmbeddingsStats } from '@/lib/hooks/use-admin-embeddings'

interface EmbeddingsTableProps {
  bookmarks: EmbeddingBookmark[]
  stats: EmbeddingsStats
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  isLoading: boolean
  isFetching: boolean
  onPageChange: (page: number) => void
  onRegenerate: (bookmarkId: string) => void
  isRegenerating: string | null
}

function getStatusColor(status: EmbeddingBookmark['processing_status']): string {
  switch (status) {
    case 'completed':
      return 'text-green-500'
    case 'processing':
      return 'text-amber-500'
    case 'pending':
      return 'text-blue-500'
    case 'failed':
      return 'text-red-500'
    default:
      return 'text-gray-500'
  }
}

function getStatusLabel(status: EmbeddingBookmark['processing_status']): string {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'processing':
      return 'Processing'
    case 'pending':
      return 'Pending'
    case 'failed':
      return 'Failed'
    default:
      return 'Unknown'
  }
}

export function EmbeddingsTable({
  bookmarks,
  stats,
  pagination,
  isLoading,
  isFetching,
  onPageChange,
  onRegenerate,
  isRegenerating,
}: EmbeddingsTableProps) {
  const columns = useMemo<ColumnDef<EmbeddingBookmark>[]>(
    () => [
      {
        accessorKey: 'title',
        header: () => (
          <span className="font-mono text-xs uppercase tracking-wider text-gray-400">
            Title
          </span>
        ),
        cell: ({ row }) => (
          <div className="max-w-[300px]">
            <span className="font-mono text-sm text-white">
              {truncateText(row.original.title, 50) || 'Untitled'}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'url',
        header: () => (
          <span className="font-mono text-xs uppercase tracking-wider text-gray-400">
            URL
          </span>
        ),
        cell: ({ row }) => {
          const url = row.original.url
          let displayUrl = url
          try {
            const parsed = new URL(url)
            displayUrl = parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '')
          } catch {
            displayUrl = truncateText(url, 40) || ''
          }
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 font-mono text-xs text-gray-400 hover:text-green-500 transition-colors"
            >
              <span>{truncateText(displayUrl, 35)}</span>
              <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          )
        },
      },
      {
        accessorKey: 'processing_status',
        header: () => (
          <span className="font-mono text-xs uppercase tracking-wider text-gray-400">
            Status
          </span>
        ),
        cell: ({ row }) => {
          const status = row.original.processing_status
          return (
            <span className={`font-mono text-xs ${getStatusColor(status)}`}>
              {getStatusLabel(status)}
            </span>
          )
        },
      },
      {
        accessorKey: 'created_at',
        header: () => (
          <span className="font-mono text-xs uppercase tracking-wider text-gray-400">
            Created
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-gray-500">
            {formatRelativeTime(row.original.created_at)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => (
          <span className="font-mono text-xs uppercase tracking-wider text-gray-400">
            Actions
          </span>
        ),
        cell: ({ row }) => {
          const bookmarkId = row.original.id
          const isCurrentlyRegenerating = isRegenerating === bookmarkId
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRegenerate(bookmarkId)}
              disabled={isCurrentlyRegenerating}
              className="font-mono text-xs h-7 px-2 text-gray-400 hover:text-green-500 hover:bg-white/5"
            >
              <RefreshCw
                className={`size-3 mr-1 ${isCurrentlyRegenerating ? 'animate-spin' : ''}`}
              />
              {isCurrentlyRegenerating ? 'Regenerating...' : 'Regenerate'}
            </Button>
          )
        },
      },
    ],
    [isRegenerating, onRegenerate]
  )

  const table = useReactTable({
    data: bookmarks,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return <EmbeddingsTableSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm text-gray-400">
            <span className="text-amber-500 font-medium">{stats.missing.toLocaleString()}</span>
            {' '}bookmarks missing embeddings out of{' '}
            <span className="text-white font-medium">{stats.total.toLocaleString()}</span>
            {' '}total
          </span>
          <span className="font-mono text-xs text-gray-500">
            ({stats.coverage_percent.toFixed(1)}% coverage)
          </span>
        </div>
        {isFetching && (
          <span className="font-mono text-xs text-gray-500 animate-pulse">
            Refreshing...
          </span>
        )}
      </div>

      {/* Table */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b border-[#1a1a1a] hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="bg-[#111111] h-10 px-4">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <span className="font-mono text-sm text-gray-500">
                    No bookmarks missing embeddings
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-[#1a1a1a] hover:bg-white/[0.02]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-xs text-gray-500">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
          {pagination.total} bookmarks
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="font-mono text-xs h-8 px-3 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50"
          >
            <ChevronLeft className="size-4 mr-1" />
            Previous
          </Button>
          <span className="font-mono text-xs text-gray-400">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="font-mono text-xs h-8 px-3 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50"
          >
            Next
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function EmbeddingsTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats Skeleton */}
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-5 w-80 bg-[#1a1a1a]" />
      </div>

      {/* Table Skeleton */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="bg-[#111111] h-10 border-b border-[#1a1a1a]" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#1a1a1a]">
            <Skeleton className="h-4 w-48 bg-[#1a1a1a]" />
            <Skeleton className="h-4 w-32 bg-[#1a1a1a]" />
            <Skeleton className="h-4 w-20 bg-[#1a1a1a]" />
            <Skeleton className="h-4 w-16 bg-[#1a1a1a]" />
            <Skeleton className="h-6 w-24 bg-[#1a1a1a]" />
          </div>
        ))}
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-4 w-48 bg-[#1a1a1a]" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 bg-[#1a1a1a]" />
          <Skeleton className="h-4 w-20 bg-[#1a1a1a]" />
          <Skeleton className="h-8 w-16 bg-[#1a1a1a]" />
        </div>
      </div>
    </div>
  )
}
