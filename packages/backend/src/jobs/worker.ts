import { Worker, Job } from 'bullmq'
import { redis } from '../config/redis'
import { QUEUE_NAMES, BookmarkProcessingJob } from './queue'
import { processBookmarkJob } from './processors/bookmark-processing'

let worker: Worker | null = null

/**
 * Start the bookmark processing worker.
 *
 * Creates a BullMQ worker that processes bookmark jobs from the queue.
 * The worker handles content extraction and AI processing for each bookmark.
 *
 * @returns The worker instance
 */
export function startWorker(): Worker {
  if (worker) {
    console.warn('[worker] Already started')
    return worker
  }

  worker = new Worker<BookmarkProcessingJob>(
    QUEUE_NAMES.BOOKMARK_PROCESSING,
    async (job: Job<BookmarkProcessingJob>) => {
      console.log(`[worker] Processing job ${job.id}: bookmark ${job.data.bookmarkId}`)
      await processBookmarkJob(job)
    },
    {
      connection: redis,
      concurrency: 5,
    }
  )

  worker.on('completed', (job) => {
    console.log(`[worker] Completed: ${job.id}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[worker] Failed: ${job?.id}`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[worker] Worker error:', err.message)
  })

  console.log('[worker] Bookmark processing worker started')
  return worker
}

/**
 * Stop the bookmark processing worker.
 *
 * Gracefully shuts down the worker, allowing any in-progress jobs to complete.
 */
export async function stopWorker(): Promise<void> {
  if (worker) {
    console.log('[worker] Stopping worker...')
    await worker.close()
    worker = null
    console.log('[worker] Worker stopped')
  }
}

/**
 * Get the current worker instance.
 *
 * @returns The worker instance or null if not started
 */
export function getWorker(): Worker | null {
  return worker
}
