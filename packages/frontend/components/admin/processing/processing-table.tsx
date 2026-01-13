'use client'

import * as React from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn, formatRelativeTime, truncateText } from '@/lib/utils'
import type { AdminProcessingJob } from '@/lib/hooks/use-admin-processing'
import { PROCESSING_STATUS_COLORS, PROCESSING_STATUS_LABELS } from '@plukd/shared'
import type { ProcessingStatus } from '@plukd/shared/types'
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'

interface ProcessingTableProps {
  jobs: AdminProcessingJob[]
  isLoading: boolean
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onReprocess: (bookmarkId: string) => void
  isReprocessing: string | null
}

const columnHelper = createColumnHelper<AdminProcessingJob>()

function StatusBadge({ status }: { status: ProcessingStatus }) {
  const label = PROCESSING_STATUS_LABELS[status] || status
  const colorClasses = PROCESSING_STATUS_COLORS[status] || 'bg-gray-500/10 text-gray-500'

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center px-2 py-0.5 text-xs font-mono font-medium',
        colorClasses
      )}
    >
      {label}
    </span>
  )
}

export function ProcessingTable({
  jobs,
  isLoading,
  page,
  totalPages,
  total,
  onPageChange,
  onReprocess,
  isReprocessing,
}: ProcessingTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'updated_at', desc: true },
  ])

  const columns = React.useMemo(
    () => [
      columnHelper.accessor('title', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-white transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Title
            <ArrowUpDown className="size-3 text-gray-500" />
          </button>
        ),
        cell: (info) => {
          const title = info.getValue()
          const url = info.row.original.url
          const displayTitle = truncateText(title, 50)
          return (
            <div className="flex items-center gap-2 max-w-[300px]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate font-mono text-sm text-white">
                    {displayTitle}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[400px] break-all">
                  <p>{title}</p>
                </TooltipContent>
              </Tooltip>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-accent transition-colors shrink-0"
              >
                <ExternalLink className="size-3" />
              </a>
            </div>
          )
        },
      }),
      columnHelper.accessor('url', {
        header: 'URL',
        cell: (info) => {
          const url = info.getValue()
          const displayUrl = truncateText(url, 40)
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-gray-400 hover:text-accent transition-colors truncate block max-w-[200px]"
                >
                  {displayUrl}
                </a>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[400px] break-all">
                <p>{url}</p>
              </TooltipContent>
            </Tooltip>
          )
        },
      }),
      columnHelper.accessor('processing_status', {
        header: 'Status',
        cell: (info) => {
          const status = info.getValue()
          const error = info.row.original.processing_error
          const isFailed = status === 'failed'

          if (isFailed && error) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 cursor-help">
                    <StatusBadge status={status} />
                    <AlertCircle className="size-3 text-red-400" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[400px] break-words">
                  <p className="text-red-400 font-mono text-xs whitespace-pre-wrap">{error}</p>
                </TooltipContent>
              </Tooltip>
            )
          }

          return <StatusBadge status={status} />
        },
      }),
      columnHelper.accessor('created_at', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-white transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Created At
            <ArrowUpDown className="size-3 text-gray-500" />
          </button>
        ),
        cell: (info) => {
          const createdAt = info.getValue()
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-mono text-xs text-gray-400 tabular-nums">
                  {formatRelativeTime(createdAt)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{new Date(createdAt).toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          )
        },
        sortingFn: 'datetime',
      }),
      columnHelper.accessor('updated_at', {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-white transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Updated At
            <ArrowUpDown className="size-3 text-gray-500" />
          </button>
        ),
        cell: (info) => {
          const updatedAt = info.getValue()
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-mono text-xs text-gray-400 tabular-nums">
                  {formatRelativeTime(updatedAt)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{new Date(updatedAt).toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          )
        },
        sortingFn: 'datetime',
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const bookmarkId = info.row.original.id
          const status = info.row.original.processing_status
          const isCurrentlyReprocessing = isReprocessing === bookmarkId
          // Only show reprocess button for failed or completed items
          const canReprocess = status === 'failed' || status === 'completed'

          if (!canReprocess) {
            return <span className="text-gray-600 font-mono text-xs">-</span>
          }

          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReprocess(bookmarkId)}
              disabled={isCurrentlyReprocessing}
              className="font-mono text-xs h-7 px-2"
            >
              {isCurrentlyReprocessing ? (
                <RefreshCw className="size-3 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="size-3" />
                  <span className="ml-1">Reprocess</span>
                </>
              )}
            </Button>
          )
        },
      }),
    ],
    [onReprocess, isReprocessing]
  )

  const table = useReactTable({
    data: jobs,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: false,
  })

  if (isLoading) {
    return (
      <div className="border border-[#1a1a1a] rounded-none bg-[#0a0a0a]">
        <div className="p-8 text-center">
          <RefreshCw className="size-5 animate-spin text-gray-500 mx-auto mb-2" />
          <p className="font-mono text-sm text-gray-500">Loading processing jobs...</p>
        </div>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="border border-[#1a1a1a] rounded-none bg-[#0a0a0a]">
        <div className="p-8 text-center">
          <p className="font-mono text-sm text-gray-500">No processing jobs found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Job count */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm text-gray-400">
          <span className="text-white font-semibold">{total}</span> bookmark{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div className="border border-[#1a1a1a] rounded-none bg-[#0a0a0a] overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-[#1a1a1a] hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="font-mono text-xs text-gray-500 uppercase tracking-wider h-10 bg-[#111111]"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="border-b border-[#1a1a1a] hover:bg-[#111111] transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="font-mono text-xs text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="font-mono text-xs h-8 px-3"
            >
              <ChevronLeft className="size-4" />
              <span className="ml-1">Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="font-mono text-xs h-8 px-3"
            >
              <span className="mr-1">Next</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
