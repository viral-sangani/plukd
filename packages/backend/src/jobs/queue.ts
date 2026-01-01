import { Queue } from 'bullmq'
import { redis } from '../config/redis'

export interface BookmarkProcessingJob {
  bookmarkId: string
  url: string
  userId: string
}

export const QUEUE_NAMES = {
  BOOKMARK_PROCESSING: 'bookmark-processing',
} as const

export const bookmarkQueue = new Queue<BookmarkProcessingJob>(
  QUEUE_NAMES.BOOKMARK_PROCESSING,
  {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        count: 1000,
        age: 24 * 3600,
      },
      removeOnFail: {
        count: 5000,
        age: 7 * 24 * 3600,
      },
    },
  }
)

export async function enqueueBookmarkProcessing(
  bookmarkId: string,
  url: string,
  userId: string
): Promise<void> {
  await bookmarkQueue.add(
    'process',
    { bookmarkId, url, userId },
    { jobId: `bookmark-${bookmarkId}` }
  )
  console.log(`[queue] Enqueued bookmark ${bookmarkId}`)
}

export async function getBookmarkJobStatus(bookmarkId: string) {
  const job = await bookmarkQueue.getJob(`bookmark-${bookmarkId}`)
  if (!job) return null

  const state = await job.getState()
  return {
    id: job.id,
    state,
    progress: job.progress,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
  }
}
