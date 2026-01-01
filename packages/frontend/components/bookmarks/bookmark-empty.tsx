'use client'

import { Bookmark, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BookmarkEmptyProps {
  className?: string
}

export function BookmarkEmpty({ className }: BookmarkEmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
    >
      <div className="mb-4 flex items-center justify-center size-12 rounded-full bg-[#18181b]">
        <Bookmark className="size-6 text-[#71717a]" />
      </div>
      <p className="text-[#fafafa] text-base font-medium mb-2">No bookmarks yet</p>
      <p className="text-[#a1a1aa] text-sm max-w-sm">
        Send links to your Telegram bot to save them here. Make sure your Telegram account is linked in Settings.
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-[#71717a]">
        <Send className="size-3" />
        <span>Send a URL to @plukd_bot on Telegram</span>
      </div>
    </div>
  )
}
