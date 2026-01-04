'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Bookmark, RawMetadata } from '@plukd/shared/types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  Archive,
  ArchiveRestore,
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
import { api } from '@/lib/api/client'

const BOOKMARK_ORDER_STORAGE_KEY = 'plukd-bookmark-order'

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
 * Load bookmark order from localStorage
 */
function loadBookmarkOrder(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(BOOKMARK_ORDER_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Save bookmark order to localStorage
 */
function saveBookmarkOrder(order: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(BOOKMARK_ORDER_STORAGE_KEY, JSON.stringify(order))
  } catch {
    // Ignore storage errors
  }
}

interface SortableBookmarkRowProps {
  bookmark: Bookmark
  isSelected: boolean
  onSelectRow: (id: string, checked: boolean) => void
  onRowClick: (bookmark: Bookmark) => void
  onCopyUrl: (url: string, e: React.MouseEvent) => void
  onOpenOriginal: (url: string, e: React.MouseEvent) => void
  onEdit: (bookmarkId: string, e: React.MouseEvent) => void
  onArchive: (bookmark: Bookmark, e: React.MouseEvent) => void
  onDelete: (bookmark: Bookmark, e: React.MouseEvent) => void
}

function SortableBookmarkRow({
  bookmark,
  isSelected,
  onSelectRow,
  onRowClick,
  onCopyUrl,
  onOpenOriginal,
  onEdit,
  onArchive,
  onDelete,
}: SortableBookmarkRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bookmark.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={isSelected ? 'selected' : undefined}
      className={cn(
        'group cursor-pointer transition-all',
        'border-l-2 border-l-[#080808] hover:border-l-accent hover:bg-[#121212]',
        'border-b border-border last:border-0',
        isSelected && 'bg-accent/5 border-l-accent',
        isDragging && 'opacity-50 bg-[#1a1a1a]'
      )}
      onClick={() => onRowClick(bookmark)}
    >
      {/* Checkbox */}
      <TableCell
        className="pl-4 pr-2 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) =>
            onSelectRow(bookmark.id, checked as boolean)
          }
          aria-label={`Select ${bookmark.title}`}
        />
      </TableCell>

      {/* Drag handle */}
      <TableCell
        className="px-2 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={cn(
            'cursor-grab active:cursor-grabbing transition-opacity text-foreground-muted hover:text-foreground-secondary',
            'opacity-0 group-hover:opacity-100 flex items-center justify-center',
            isDragging && 'cursor-grabbing opacity-100'
          )}
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      </TableCell>

      {/* Thumbnail */}
      <TableCell className="pl-2 pr-4 py-3">
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
                <div className="font-mono font-medium text-foreground line-clamp-1 text-sm flex items-center gap-2">
                  {getDisplayTitle(bookmark.title, bookmark.url)}
                  {(bookmark.processing_status === 'pending' || bookmark.processing_status === 'processing') && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-accent shrink-0">
                      <Loader2 className="size-3 animate-spin" />
                      <span className="hidden sm:inline">Processing...</span>
                    </span>
                  )}
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
          onClick={(e) => onOpenOriginal(bookmark.url, e)}
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
                onOpenOriginal(bookmark.url, e as unknown as React.MouseEvent)
              }
            >
              <ExternalLink className="size-4" />
              Open original
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) =>
                onCopyUrl(bookmark.url, e as unknown as React.MouseEvent)
              }
            >
              <Copy className="size-4" />
              Copy URL
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) =>
                onEdit(bookmark.id, e as unknown as React.MouseEvent)
              }
            >
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) =>
                onArchive(bookmark, e as unknown as React.MouseEvent)
              }
            >
              {bookmark.is_archived ? (
                <>
                  <ArchiveRestore className="size-4" />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive className="size-4" />
                  Archive
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) =>
                onDelete(bookmark, e as unknown as React.MouseEvent)
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
}

/**
 * Static row for DragOverlay - doesn't use sortable hooks
 */
function BookmarkRowOverlay({ bookmark }: { bookmark: Bookmark }) {
  return (
    <table className="w-full">
      <tbody>
        <tr
          className={cn(
            'bg-[#1a1a1a] shadow-2xl border border-accent/50 rounded-md',
            'cursor-grabbing'
          )}
        >
          {/* Checkbox */}
          <td className="pl-4 pr-2 py-3 w-[40px]">
            <Checkbox checked={false} disabled />
          </td>

          {/* Drag handle */}
          <td className="px-2 py-3 w-[36px]">
            <div className="text-accent flex items-center justify-center">
              <GripVertical className="size-4" />
            </div>
          </td>

          {/* Thumbnail */}
          <td className="pl-2 pr-4 py-3 w-[80px]">
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
          </td>

          {/* Title */}
          <td className="py-3">
            <div className="space-y-0.5 min-w-0">
              <div className="font-mono font-medium text-foreground line-clamp-1 text-sm">
                {getDisplayTitle(bookmark.title, bookmark.url)}
              </div>
              <div className="text-[11px] text-foreground-muted line-clamp-1 font-mono">
                {formatDisplayUrl(bookmark.url)}
              </div>
            </div>
          </td>

          {/* Source */}
          <td className="py-3 w-[100px]">
            <SourceBadge source={bookmark.source} size="sm" />
          </td>

          {/* Category */}
          <td className="py-3 w-[140px]">
            <CategoryBadge category={bookmark.category} />
          </td>

          {/* Date */}
          <td className="py-3 w-[110px] text-xs text-foreground-muted font-mono tabular-nums">
            {formatTimeAgo(bookmark.created_at)}
          </td>

          {/* Spacer cells */}
          <td className="w-[48px]" />
          <td className="w-[48px]" />
        </tr>
      </tbody>
    </table>
  )
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface BookmarkTableProps {
  bookmarks: Bookmark[]
  /** Server-side pagination info */
  pagination?: PaginationInfo
  /** Current page number (1-indexed) */
  currentPage: number
  /** Number of rows per page */
  rowsPerPage: number
  /** Callback when page changes */
  onPageChange: (page: number) => void
  /** Callback when rows per page changes */
  onRowsPerPageChange: (rows: number) => void
  /** Whether a page change is in progress (for loading state) */
  isPageChanging?: boolean
  onSelectBookmark?: (bookmark: Bookmark) => void
  onSelectionChange?: (selectedIds: Set<string>) => void
  isDeleteDialogOpen?: boolean
  onDeleteDialogOpenChange?: (open: boolean) => void
  emptyComponent?: React.ReactNode
  className?: string
}

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100]

export function BookmarkTable({
  bookmarks,
  pagination,
  currentPage,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  isPageChanging = false,
  onSelectBookmark,
  onSelectionChange,
  isDeleteDialogOpen: controlledDeleteDialogOpen,
  onDeleteDialogOpenChange,
  emptyComponent,
  className,
}: BookmarkTableProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [internalDeleteDialogOpen, setInternalDeleteDialogOpen] = React.useState(false)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [orderedBookmarkIds, setOrderedBookmarkIds] = React.useState<string[]>([])

  // Use controlled or internal state for delete dialog
  const isDeleteDialogOpen = controlledDeleteDialogOpen ?? internalDeleteDialogOpen
  const setIsDeleteDialogOpen = onDeleteDialogOpenChange ?? setInternalDeleteDialogOpen
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteProgress, setDeleteProgress] = React.useState({ current: 0, total: 0 })
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc' | 'custom'>('desc')

  // Initialize ordered bookmark IDs from localStorage or bookmarks
  React.useEffect(() => {
    const savedOrder = loadBookmarkOrder()
    const currentIds = bookmarks.map((b) => b.id)

    if (savedOrder.length > 0) {
      // Filter saved order to only include IDs that still exist
      const validSavedOrder = savedOrder.filter((id) => currentIds.includes(id))
      // Add any new IDs that aren't in the saved order
      const newIds = currentIds.filter((id) => !savedOrder.includes(id))
      const mergedOrder = [...validSavedOrder, ...newIds]

      if (mergedOrder.length > 0) {
        setOrderedBookmarkIds(mergedOrder)
        // If we have a saved order, switch to custom sort
        if (validSavedOrder.length > 0) {
          setSortOrder('custom')
        }
      }
    } else {
      setOrderedBookmarkIds(currentIds)
    }
  }, [bookmarks])

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sort bookmarks based on current sort order (client-side reordering for drag-drop)
  // Note: With server-side pagination, sorting is primarily done server-side,
  // but we keep this for custom drag-drop ordering within the current page
  const sortedBookmarks = React.useMemo(() => {
    if (sortOrder === 'custom' && orderedBookmarkIds.length > 0) {
      // Sort by custom order
      const orderMap = new Map(orderedBookmarkIds.map((id, index) => [id, index]))
      return [...bookmarks].sort((a, b) => {
        const indexA = orderMap.get(a.id) ?? Infinity
        const indexB = orderMap.get(b.id) ?? Infinity
        return indexA - indexB
      })
    }

    // When not in custom order mode, use the server's order
    return bookmarks
  }, [bookmarks, sortOrder, orderedBookmarkIds])

  // Use server-side pagination info
  const totalRows = pagination?.total ?? bookmarks.length
  const totalPages = pagination?.totalPages ?? Math.ceil(bookmarks.length / rowsPerPage)

  // With server-side pagination, bookmarks are already paginated - no need to slice
  const paginatedBookmarks = sortedBookmarks

  // Get sortable IDs for current page
  const sortableIds = React.useMemo(
    () => paginatedBookmarks.map((b) => b.id),
    [paginatedBookmarks]
  )

  // Notify parent of selection changes
  React.useEffect(() => {
    onSelectionChange?.(selectedIds)
  }, [selectedIds, onSelectionChange])

  const handleSelectAll = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        // Select all bookmarks on the current page
        setSelectedIds(new Set(bookmarks.map((b) => b.id)))
      } else {
        setSelectedIds(new Set())
      }
    },
    [bookmarks]
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
        await api.delete(`/api/bookmarks/${bookmark.id}`)

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

  const handleArchive = React.useCallback(
    async (bookmark: Bookmark, e: React.MouseEvent) => {
      e.stopPropagation()
      const newArchivedState = !bookmark.is_archived
      try {
        await api.patch(`/api/bookmarks/${bookmark.id}`, {
          is_archived: newArchivedState,
        })

        toast.success(newArchivedState ? 'Bookmark archived' : 'Bookmark unarchived')

        // Dispatch event to refresh sidebar counts and bookmark list
        window.dispatchEvent(new CustomEvent('bookmarks-updated'))
        router.refresh()
      } catch {
        toast.error(newArchivedState ? 'Failed to archive bookmark' : 'Failed to unarchive bookmark')
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
          await api.delete(`/api/bookmarks/${id}`)
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
  }, [selectedIds, router, setIsDeleteDialogOpen])

  // Drag and drop handlers
  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      setActiveId(null)

      if (over && active.id !== over.id) {
        // Find the indices in the full sorted list
        const oldIndex = sortedBookmarks.findIndex((b) => b.id === active.id)
        const overIndex = sortedBookmarks.findIndex((b) => b.id === over.id)

        if (oldIndex !== -1 && overIndex !== -1) {
          // Create new order from full sorted bookmarks
          const newSortedIds = sortedBookmarks.map((b) => b.id)
          const reorderedIds = arrayMove(newSortedIds, oldIndex, overIndex)

          setOrderedBookmarkIds(reorderedIds)
          saveBookmarkOrder(reorderedIds)

          // Switch to custom sort order
          if (sortOrder !== 'custom') {
            setSortOrder('custom')
          }

          toast.success('Bookmark order updated', {
            duration: 2000,
          })
        }
      }
    },
    [sortedBookmarks, sortOrder]
  )

  const handleDragCancel = React.useCallback(() => {
    setActiveId(null)
  }, [])

  // Cycle through sort orders
  const handleSortClick = React.useCallback(() => {
    setSortOrder((prev) => {
      if (prev === 'desc') return 'asc'
      if (prev === 'asc') return 'custom'
      return 'desc'
    })
  }, [])

  const isAllSelected =
    bookmarks.length > 0 &&
    bookmarks.every((b) => selectedIds.has(b.id))
  const isSomeSelected =
    bookmarks.some((b) => selectedIds.has(b.id)) && !isAllSelected

  if (bookmarks.length === 0) {
    return emptyComponent ?? <BookmarkEmpty className={className} />
  }

  const selectedCount = selectedIds.size
  const activeBookmark = activeId
    ? bookmarks.find((b) => b.id === activeId)
    : null

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

      {/* Table with DnD Context */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={cn(
          "rounded-none overflow-hidden border border-border relative",
          isPageChanging && "opacity-60 pointer-events-none"
        )}>
          {isPageChanging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
              <Loader2 className="size-6 animate-spin text-accent" />
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent hover:bg-transparent border-b border-border">
                {/* Checkbox */}
                <TableHead className="w-[40px] pl-4 pr-2">
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
                <TableHead className="w-[36px] px-2">
                  <span className="sr-only">Drag handle</span>
                </TableHead>
                {/* Thumbnail */}
                <TableHead className="w-[80px] pl-2 pr-4">
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
                    onClick={handleSortClick}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    title={
                      sortOrder === 'custom'
                        ? 'Custom order (drag to reorder)'
                        : sortOrder === 'desc'
                        ? 'Newest first'
                        : 'Oldest first'
                    }
                  >
                    Date
                    {sortOrder === 'custom' ? (
                      <GripVertical className="size-3" />
                    ) : sortOrder === 'desc' ? (
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
              <SortableContext
                items={sortableIds}
                strategy={verticalListSortingStrategy}
              >
                {paginatedBookmarks.map((bookmark) => (
                  <SortableBookmarkRow
                    key={bookmark.id}
                    bookmark={bookmark}
                    isSelected={selectedIds.has(bookmark.id)}
                    onSelectRow={handleSelectRow}
                    onRowClick={handleRowClick}
                    onCopyUrl={handleCopyUrl}
                    onOpenOriginal={handleOpenOriginal}
                    onEdit={handleEdit}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeBookmark ? (
            <BookmarkRowOverlay bookmark={activeBookmark} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 py-3">
        {/* Selection info */}
        <div className="text-xs text-foreground-muted font-mono flex items-center gap-2">
          <span>{selectedIds.size} of {totalRows} row(s) selected</span>
          {isPageChanging && (
            <Loader2 className="size-3 animate-spin text-accent" />
          )}
        </div>

        {/* Pagination controls */}
        <div className="flex items-center gap-6">
          {/* Rows per page */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-foreground-muted font-mono uppercase tracking-[0.15em]">Rows per page</span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(value) => onRowsPerPageChange(Number(value))}
              disabled={isPageChanging}
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
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1 || isPageChanging}
              aria-label="First page"
            >
              <ChevronsLeft className="size-4 transition-colors text-foreground-muted group-hover:text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="group"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isPageChanging}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4 transition-colors text-foreground-muted group-hover:text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="group"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || totalPages === 0 || isPageChanging}
              aria-label="Next page"
            >
              <ChevronRight className="size-4 transition-colors text-foreground-muted group-hover:text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="group"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0 || isPageChanging}
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
