'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDeleteBookmark } from '@/lib/hooks'

interface DeleteBookmarkDialogProps {
  bookmarkId: string
  bookmarkTitle: string
  onDelete?: () => void
}

export function DeleteBookmarkDialog({
  bookmarkId,
  bookmarkTitle,
  onDelete,
}: DeleteBookmarkDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const deleteBookmark = useDeleteBookmark()

  const handleDelete = async () => {
    try {
      await deleteBookmark.mutateAsync({ id: bookmarkId })
      setIsOpen(false)
      onDelete?.()
      toast.success('Bookmark deleted successfully')
      router.push('/')
    } catch (err) {
      console.error('Error deleting bookmark:', err)
      toast.error('Failed to delete bookmark', {
        description: err instanceof Error ? err.message : 'Please try again',
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Trash2 className="size-4" />
          Delete Bookmark
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Bookmark</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              Are you sure you want to delete this bookmark? This action cannot
              be undone.
            </span>
            <span className="block text-foreground font-medium">
              &quot;{bookmarkTitle}&quot;
            </span>
          </DialogDescription>
        </DialogHeader>
        {deleteBookmark.error && (
          <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md p-2">
            {deleteBookmark.error instanceof Error
              ? deleteBookmark.error.message
              : 'Failed to delete bookmark. Please try again.'}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={deleteBookmark.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteBookmark.isPending}
          >
            {deleteBookmark.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
