'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, Link as LinkIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AddBookmarkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddBookmarkDialog({ open, onOpenChange, onSuccess }: AddBookmarkDialogProps) {
  const [url, setUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    // Basic URL validation
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    try {
      new URL(normalizedUrl)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: normalizedUrl }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save bookmark')
      }

      toast.success('Bookmark saved', {
        description: 'AI processing will complete shortly',
      })

      // Reset form and close dialog
      setUrl('')
      onOpenChange(false)

      // Trigger refresh
      onSuccess?.()
      window.dispatchEvent(new Event('bookmarks-updated'))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save bookmark'
      setError(message)
      toast.error('Failed to save bookmark', {
        description: message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      if (!newOpen) {
        // Reset form when closing
        setUrl('')
        setError(null)
      }
      onOpenChange(newOpen)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-corners="diagonal"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          // Focus input without scrolling
          inputRef.current?.focus({ preventScroll: true })
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Bookmark</DialogTitle>
            <DialogDescription>
              Enter a URL to save. AI will automatically extract and summarize the content.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <div className="space-y-2">
              <label
                htmlFor="url"
                className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted"
              >
                URL
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground-muted" />
                <Input
                  ref={inputRef}
                  id="url"
                  type="text"
                  placeholder="https://example.com/article"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value)
                    setError(null)
                  }}
                  className="pl-10"
                  disabled={isSubmitting}
                />
              </div>
              {error && (
                <p className="text-xs font-mono text-red-400">{error}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !url.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Bookmark'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
