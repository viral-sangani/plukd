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
  X,
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
  className?: string
}

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100]

export function BookmarkTable({
  bookmarks,
  onSelectBookmark,
  className,
}: BookmarkTableProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = React.useState(1)
  const [rowsPerPage, setRowsPerPage] = React.useState(10)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteProgress, setDeleteProgress] = React.useState({ current: 0, total: 0 })

  // Pagination calculations
  const totalRows = bookmarks.length
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows)
  const paginatedBookmarks = bookmarks.slice(startIndex, endIndex)

  // Reset to first page when bookmarks change significantly
  React.useEffect(() => {
    if (currentPage > Math.ceil(bookmarks.length / rowsPerPage)) {
      setCurrentPage(1)
    }
  }, [bookmarks.length, rowsPerPage, currentPage])

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

  const handleClearSelection = React.useCallback(() => {
    setSelectedIds(new Set())
  }, [])

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
      {/* Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-[#09090b] px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">
              {selectedCount} selected
            </span>
            <div className="h-4 w-px bg-border-subtle" />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="gap-1.5"
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleClearSelection}
            aria-label="Clear selection"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

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
      <div className="rounded-lg border border-border-subtle overflow-hidden bg-[#09090b]">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#18181b] hover:bg-[#18181b] border-b border-border-subtle">
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
              <TableHead className="text-foreground-secondary font-medium text-xs uppercase tracking-wider">
                Title
              </TableHead>
              {/* Source */}
              <TableHead className="w-[100px] text-foreground-secondary font-medium text-xs uppercase tracking-wider">
                Source
              </TableHead>
              {/* Category */}
              <TableHead className="w-[140px] text-foreground-secondary font-medium text-xs uppercase tracking-wider">
                Category
              </TableHead>
              {/* Date */}
              <TableHead className="w-[90px] text-foreground-secondary font-medium text-xs uppercase tracking-wider">
                Date
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
                    'group cursor-pointer transition-colors',
                    'hover:bg-background-emphasis',
                    'border-b border-border-subtle last:border-0',
                    isSelected && 'bg-background-emphasis'
                  )}
                  onClick={() => handleRowClick(bookmark)}
                >
                  {/* Checkbox */}
                  <TableCell
                    className="px-4 py-4"
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
                    className="px-0 py-4"
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
                  <TableCell className="px-2 py-4">
                    <div className="relative size-14 flex-shrink-0 overflow-hidden rounded-md bg-background-emphasis">
                      {getThumbnailUrl(bookmark) ? (
                        <Image
                          src={getThumbnailUrl(bookmark)!}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-foreground-muted">
                          <ImageIcon className="size-5" />
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Title & Description with hover preview */}
                  <TableCell className="py-4 min-w-0">
                    <HoverCard openDelay={300} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <Link
                          href={`/bookmark/${bookmark.id}`}
                          className="block min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-1 text-[15px]">
                              {getDisplayTitle(bookmark.title, bookmark.url)}
                            </div>
                            {bookmark.blurb && (
                              <div className="text-sm text-foreground-muted line-clamp-1">
                                {truncateWords(bookmark.blurb, 8)}
                              </div>
                            )}
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
                  <TableCell className="py-4">
                    <SourceBadge source={bookmark.source} size="sm" />
                  </TableCell>

                  {/* Category */}
                  <TableCell className="py-4">
                    <CategoryBadge category={bookmark.category} />
                  </TableCell>

                  {/* Date */}
                  <TableCell className="py-4 text-sm text-foreground-muted">
                    {formatTimeAgo(bookmark.created_at)}
                  </TableCell>

                  {/* Actions */}
                  <TableCell
                    className="px-2 py-4"
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
      <div className="flex items-center justify-between px-2">
        {/* Selection info */}
        <div className="text-sm text-foreground-muted">
          {selectedIds.size} of {totalRows} row(s) selected
        </div>

        {/* Pagination controls */}
        <div className="flex items-center gap-6">
          {/* Rows per page */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground-muted">Rows per page</span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(value) => {
                setRowsPerPage(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[70px]">
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
          <div className="text-sm text-foreground-muted">
            Page {currentPage} of {totalPages || 1}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
