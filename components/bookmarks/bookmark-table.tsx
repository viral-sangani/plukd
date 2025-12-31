'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Bookmark, RawMetadata } from '@/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { SourceBadge } from '@/components/ui/source-badge'
import { CategoryBadge } from '@/components/ui/category-badge'
import { BookmarkEmpty } from './bookmark-empty'
import { BookmarkPreviewCard } from './bookmark-preview-card'
import {
  GripVertical,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  ImageIcon,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn, formatTimeAgo } from '@/lib/utils'

/**
 * Gets the thumbnail URL from bookmark media_urls or OG image
 */
function getThumbnailUrl(bookmark: Bookmark): string | null {
  // First try media_urls
  if (bookmark.media_urls && bookmark.media_urls.length > 0) {
    return bookmark.media_urls[0]
  }

  // Then try OG image from raw_metadata
  const rawMetadata = bookmark.raw_metadata as RawMetadata | null
  if (rawMetadata?.og?.image) {
    return rawMetadata.og.image
  }

  return null
}

/**
 * Formats a URL for display by extracting domain and truncating path
 */
function formatDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const domain = parsed.hostname.replace(/^www\./, '')
    const path = parsed.pathname

    if (path === '/' || path === '') {
      return domain
    }

    // Truncate long paths
    const maxPathLength = 30
    const truncatedPath =
      path.length > maxPathLength ? path.slice(0, maxPathLength) + '...' : path

    return `${domain}${truncatedPath}`
  } catch {
    // If URL parsing fails, return truncated URL
    const maxLength = 50
    return url.length > maxLength ? url.slice(0, maxLength) + '...' : url
  }
}

/**
 * Determines whether to show the title or formatted URL
 */
function getDisplayTitle(title: string, url: string): string {
  // If title is empty, null, or matches the URL, show formatted URL
  if (!title || title.trim() === '' || title === url) {
    return formatDisplayUrl(url)
  }
  return title
}

/**
 * Truncates text to a specified number of words
 */
function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) {
    return text
  }
  return words.slice(0, maxWords).join(' ') + '...'
}

interface BookmarkTableProps {
  bookmarks: Bookmark[]
  onSelectBookmark?: (bookmark: Bookmark) => void
  onSelectionChange?: (selectedIds: Set<string>) => void
  isDeleteDialogOpen?: boolean
  onDeleteDialogOpenChange?: (open: boolean) => void
  className?: string
}

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100]

export function BookmarkTable({
  bookmarks,
  onSelectBookmark,
  onSelectionChange,
  isDeleteDialogOpen: controlledDeleteDialogOpen,
  onDeleteDialogOpenChange,
  className,
}: BookmarkTableProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [internalDeleteDialogOpen, setInternalDeleteDialogOpen] = React.useState(false)

  // Use controlled or internal state for delete dialog
  const isDeleteDialogOpen = controlledDeleteDialogOpen ?? internalDeleteDialogOpen
  const setIsDeleteDialogOpen = onDeleteDialogOpenChange ?? setInternalDeleteDialogOpen
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteProgress, setDeleteProgress] = React.useState({ current: 0, total: 0 })
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc')

  // Sort bookmarks by date
  const sortedBookmarks = React.useMemo(() => {
    return [...bookmarks].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
    })
  }, [bookmarks, sortOrder])

  // Pagination calculations
  const totalRows = sortedBookmarks.length
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows)
  const paginatedBookmarks = sortedBookmarks.slice(startIndex, endIndex)

  // Reset to first page when bookmarks change significantly
  React.useEffect(() => {
    if (currentPage > Math.ceil(bookmarks.length / rowsPerPage)) {
      setCurrentPage(1)
    }
  }, [bookmarks.length, rowsPerPage, currentPage])

  // Notify parent of selection changes
  React.useEffect(() => {
    onSelectionChange?.(selectedIds)
  }, [selectedIds, onSelectionChange])

  const handleSelectAll = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(paginatedBookmarks.map((b) => b.id)))
      } else {
        setSelectedIds(new Set())
      }
    },
    [paginatedBookmarks]
  )

  const handleSelectRow = React.useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const handleRowClick = React.useCallback(
    (bookmark: Bookmark) => {
      onSelectBookmark?.(bookmark)
      router.push(`/bookmark/${bookmark.id}`)
    },
    [onSelectBookmark, router]
  )

  const handleCopyUrl = React.useCallback(
    async (url: string, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await navigator.clipboard.writeText(url)
        toast.success('URL copied to clipboard')
      } catch {
        toast.error('Failed to copy URL')
      }
    },
    []
  )

  const handleOpenOriginal = React.useCallback(
    (url: string, e: React.MouseEvent) => {
      e.stopPropagation()
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    []
  )

  const handleEdit = React.useCallback(
    (bookmarkId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      router.push(`/bookmark/${bookmarkId}`)
    },
    [router]
  )

  const handleDelete = React.useCallback(
    async (bookmark: Bookmark, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        const response = await fetch(`/api/bookmarks/${bookmark.id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          throw new Error('Failed to delete bookmark')
        }

        toast.success('Bookmark deleted')

        // Dispatch event to refresh sidebar counts and bookmark list
        window.dispatchEvent(new CustomEvent('bookmarks-updated'))
        router.refresh()
      } catch {
        toast.error('Failed to delete bookmark')
      }
    },
    [router]
  )

  const handleBulkDelete = React.useCallback(async () => {
    const idsToDelete = Array.from(selectedIds)
    if (idsToDelete.length === 0) return

    setIsDeleting(true)
    setDeleteProgress({ current: 0, total: idsToDelete.length })

    let successCount = 0
    let failCount = 0

    // Delete bookmarks in parallel with a concurrency limit
    const CONCURRENCY_LIMIT = 5
    for (let i = 0; i < idsToDelete.length; i += CONCURRENCY_LIMIT) {
      const batch = idsToDelete.slice(i, i + CONCURRENCY_LIMIT)
      const results = await Promise.allSettled(
        batch.map(async (id) => {
          const response = await fetch(`/api/bookmarks/${id}`, {
            method: 'DELETE',
          })
          if (!response.ok) {
            throw new Error('Failed to delete')
          }
          return id
        })
      )

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          successCount++
        } else {
          failCount++
        }
      })

      setDeleteProgress({ current: i + batch.length, total: idsToDelete.length })
    }

    setIsDeleting(false)
    setIsDeleteDialogOpen(false)
    setSelectedIds(new Set())
    setDeleteProgress({ current: 0, total: 0 })

    // Show result toast
    if (failCount === 0) {
      toast.success(`Deleted ${successCount} bookmark${successCount !== 1 ? 's' : ''}`)
    } else if (successCount === 0) {
      toast.error(`Failed to delete ${failCount} bookmark${failCount !== 1 ? 's' : ''}`)
    } else {
      toast.warning(
        `Deleted ${successCount} bookmark${successCount !== 1 ? 's' : ''}, ${failCount} failed`
      )
    }

    // Dispatch event to refresh the table and sidebar counts
    window.dispatchEvent(new Event('bookmarks-updated'))
    router.refresh()
  }, [selectedIds, router])

  const isAllSelected =
    paginatedBookmarks.length > 0 &&
    paginatedBookmarks.every((b) => selectedIds.has(b.id))
  const isSomeSelected =
    paginatedBookmarks.some((b) => selectedIds.has(b.id)) && !isAllSelected

  if (bookmarks.length === 0) {
    return <BookmarkEmpty className={className} />
  }

  const selectedCount = selectedIds.size

  return (
    <div className={cn('space-y-4', className)}>
      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent showCloseButton={!isDeleting}>
          <DialogHeader>
            <DialogTitle>Delete {selectedCount} bookmark{selectedCount !== 1 ? 's' : ''}?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the selected
              bookmark{selectedCount !== 1 ? 's' : ''} from your library.
            </DialogDescription>
          </DialogHeader>
          {isDeleting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-foreground-muted">
                <span>Deleting bookmarks...</span>
                <span>
                  {deleteProgress.current} / {deleteProgress.total}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-background-emphasis">
                <div
                  className="h-full bg-destructive transition-all duration-300"
                  style={{
                    width: `${deleteProgress.total > 0 ? (deleteProgress.current / deleteProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="rounded-none overflow-hidden border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-transparent hover:bg-transparent border-b border-border">
              {/* Checkbox */}
              <TableHead className="w-[40px] px-4">
                <Checkbox
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) {
                      ;(el as HTMLButtonElement & { indeterminate: boolean }).indeterminate =
                        isSomeSelected
                    }
                  }}
                  onCheckedChange={(checked) =>
                    handleSelectAll(checked as boolean)
                  }
                  aria-label="Select all"
                />
              </TableHead>
              {/* Drag handle */}
              <TableHead className="w-[32px] px-0">
                <span className="sr-only">Drag handle</span>
              </TableHead>
              {/* Thumbnail */}
              <TableHead className="w-[72px] px-2">
                <span className="sr-only">Thumbnail</span>
              </TableHead>
              {/* Title & Description */}
              <TableHead className="text-foreground-muted font-mono font-normal text-[10px] uppercase tracking-[0.15em]">
                Title
              </TableHead>
              {/* Source */}
              <TableHead className="w-[100px] text-foreground-muted font-mono font-normal text-[10px] uppercase tracking-[0.15em]">
                Source
              </TableHead>
              {/* Category */}
              <TableHead className="w-[140px] text-foreground-muted font-mono font-normal text-[10px] uppercase tracking-[0.15em]">
                Category
              </TableHead>
              {/* Date */}
              <TableHead className="w-[110px] text-foreground-muted font-mono font-normal text-[10px] uppercase tracking-[0.15em]">
                <button
                  type="button"
                  onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Date
                  {sortOrder === 'desc' ? (
                    <ArrowDown className="size-3" />
                  ) : (
                    <ArrowUp className="size-3" />
                  )}
                </button>
              </TableHead>
              {/* Open URL */}
              <TableHead className="w-[48px] px-2">
                <span className="sr-only">Open URL</span>
              </TableHead>
              {/* Actions */}
              <TableHead className="w-[48px] px-2">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedBookmarks.map((bookmark) => {
              const isSelected = selectedIds.has(bookmark.id)
              return (
                <TableRow
                  key={bookmark.id}
                  data-state={isSelected ? 'selected' : undefined}
                  className={cn(
                    'group cursor-pointer transition-all',
                    'border-l-2 border-l-[#080808] hover:border-l-accent hover:bg-[#121212]',
                    'border-b border-border last:border-0',
                    isSelected && 'bg-accent/5 border-l-accent'
                  )}
                  onClick={() => handleRowClick(bookmark)}
                >
                  {/* Checkbox */}
                  <TableCell
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleSelectRow(bookmark.id, checked as boolean)
                      }
                      aria-label={`Select ${bookmark.title}`}
                    />
                  </TableCell>

                  {/* Drag handle */}
                  <TableCell
                    className="px-0 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-foreground-muted hover:text-foreground-secondary"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="size-4" />
                    </button>
                  </TableCell>

                  {/* Thumbnail */}
                  <TableCell className="px-2 py-3">
                    <div className="relative size-12 flex-shrink-0 overflow-hidden rounded-none bg-background-emphasis">
                      {getThumbnailUrl(bookmark) ? (
                        <Image
                          src={getThumbnailUrl(bookmark)!}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="48px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-foreground-muted">
                          <ImageIcon className="size-4" />
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Title & URL with hover preview */}
                  <TableCell className="py-3 min-w-0">
                    <HoverCard openDelay={300} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <Link
                          href={`/bookmark/${bookmark.id}`}
                          className="block min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-mono font-medium text-foreground line-clamp-1 text-sm">
                              {getDisplayTitle(bookmark.title, bookmark.url)}
                            </div>
                            <div className="text-[11px] text-foreground-muted line-clamp-1 font-mono">
                              {formatDisplayUrl(bookmark.url)}
                            </div>
                          </div>
                        </Link>
                      </HoverCardTrigger>
                      <HoverCardContent
                        side="right"
                        align="start"
                        sideOffset={8}
                        className="w-72"
                      >
                        <BookmarkPreviewCard bookmark={bookmark} />
                      </HoverCardContent>
                    </HoverCard>
                  </TableCell>

                  {/* Source */}
                  <TableCell className="py-3">
                    <SourceBadge source={bookmark.source} size="sm" />
                  </TableCell>

                  {/* Category */}
                  <TableCell className="py-3">
                    <CategoryBadge category={bookmark.category} />
                  </TableCell>

                  {/* Date */}
                  <TableCell className="py-3 text-xs text-foreground-muted font-mono tabular-nums">
                    {formatTimeAgo(bookmark.created_at)}
                  </TableCell>

                  {/* Open URL */}
                  <TableCell
                    className="px-2 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => handleOpenOriginal(bookmark.url, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-foreground-muted hover:text-accent"
                      title="Open in new tab"
                    >
                      <ExternalLink className="size-4" />
                      <span className="sr-only">Open URL in new tab</span>
                    </Button>
                  </TableCell>

                  {/* Actions */}
                  <TableCell
                    className="px-2 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={(e) =>
                            handleOpenOriginal(bookmark.url, e as unknown as React.MouseEvent)
                          }
                        >
                          <ExternalLink className="size-4" />
                          Open original
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) =>
                            handleCopyUrl(bookmark.url, e as unknown as React.MouseEvent)
                          }
                        >
                          <Copy className="size-4" />
                          Copy URL
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) =>
                            handleEdit(bookmark.id, e as unknown as React.MouseEvent)
                          }
                        >
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) =>
                            handleDelete(bookmark, e as unknown as React.MouseEvent)
                          }
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 py-3">
        {/* Selection info */}
        <div className="text-xs text-foreground-muted font-mono">
          {selectedIds.size} of {totalRows} row(s) selected
        </div>

        {/* Pagination controls */}
        <div className="flex items-center gap-6">
          {/* Rows per page */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-foreground-muted font-mono uppercase tracking-[0.15em]">Rows per page</span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(value) => {
                setRowsPerPage(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[70px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROWS_PER_PAGE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page info */}
          <div className="text-xs text-foreground-muted font-mono tabular-nums">
            Page {currentPage} of {totalPages || 1}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="group"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              aria-label="First page"
            >
              <ChevronsLeft className="size-4 transition-colors text-foreground-muted group-hover:text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="group"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4 transition-colors text-foreground-muted group-hover:text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="group"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              aria-label="Next page"
            >
              <ChevronRight className="size-4 transition-colors text-foreground-muted group-hover:text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="group"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              aria-label="Last page"
            >
              <ChevronsRight className="size-4 transition-colors text-foreground-muted group-hover:text-foreground" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
