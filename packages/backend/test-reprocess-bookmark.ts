#!/usr/bin/env tsx
/**
 * Script to re-process a specific bookmark to test Instagram carousel extraction fixes
 *
 * Usage: tsx test-reprocess-bookmark.ts <bookmark-id>
 */

import { createClient } from '@supabase/supabase-js'
import { processBookmarkJob } from './src/jobs/processors/bookmark-processing'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function reprocessBookmark(bookmarkId: string) {
  console.log(`\n[REPROCESS] Fetching bookmark ${bookmarkId}...\n`)

  // Fetch the bookmark
  const { data: bookmark, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('id', bookmarkId)
    .single()

  if (error || !bookmark) {
    console.error(`[REPROCESS] Error fetching bookmark: ${error?.message || 'Not found'}`)
    return
  }

  console.log(`[REPROCESS] Found bookmark:`)
  console.log(`  URL: ${bookmark.url}`)
  console.log(`  Current Title: ${bookmark.title}`)
  console.log(`  Current Category: ${bookmark.category}`)
  console.log(`  Current Content Type: ${bookmark.content_type}`)
  console.log(`  Current Processing Status: ${bookmark.processing_status}\n`)

  // Reset processing status
  console.log(`[REPROCESS] Resetting processing status to 'pending'...\n`)
  const { error: updateError } = await supabase
    .from('bookmarks')
    .update({
      processing_status: 'pending',
      // Clear AI-generated fields to force re-processing
      title: bookmark.url,
      content: null,
      blurb: null,
      summary: null,
      category: null,
      tags: null,
      extracted_resources: null,
      raw_metadata: null,
      media_urls: null
    })
    .eq('id', bookmarkId)

  if (updateError) {
    console.error(`[REPROCESS] Error updating bookmark: ${updateError.message}`)
    return
  }

  console.log(`[REPROCESS] Re-processing bookmark...\n`)
  console.log('=' .repeat(80))
  console.log('\n')

  // Process the bookmark - create a mock job object
  const mockJob = {
    data: {
      bookmarkId,
      userId: bookmark.user_id,
      url: bookmark.url,
    },
  } as any

  try {
    await processBookmarkJob(mockJob)
    console.log('\n')
    console.log('=' .repeat(80))
    console.log(`\n[REPROCESS] Processing completed! Fetching updated bookmark...\n`)

    // Fetch the updated bookmark
    const { data: updatedBookmark, error: fetchError } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('id', bookmarkId)
      .single()

    if (fetchError || !updatedBookmark) {
      console.error(`[REPROCESS] Error fetching updated bookmark: ${fetchError?.message}`)
      return
    }

    console.log(`[REPROCESS] Updated bookmark:`)
    console.log(`  Title: ${updatedBookmark.title}`)
    console.log(`  Category: ${updatedBookmark.category}`)
    console.log(`  Content Type: ${updatedBookmark.content_type}`)
    console.log(`  Processing Status: ${updatedBookmark.processing_status}`)
    console.log(`  Content Length: ${updatedBookmark.content?.length || 0} chars`)
    console.log(`  Blurb Length: ${updatedBookmark.blurb?.length || 0} chars`)
    console.log(`  Summary Length: ${updatedBookmark.summary?.length || 0} chars`)
    console.log(`  Media URLs: ${updatedBookmark.media_urls?.length || 0}`)
    console.log(`  Extracted Resources: ${updatedBookmark.extracted_resources?.length || 0}`)
    console.log(`  Tags: ${updatedBookmark.tags?.join(', ') || 'none'}`)

    if (updatedBookmark.raw_metadata?.instagram) {
      const instagram = updatedBookmark.raw_metadata.instagram
      console.log(`\n  Instagram Metadata:`)
      console.log(`    isCarousel: ${instagram.isCarousel}`)
      console.log(`    carouselItems: ${instagram.carouselItems?.length || 0}`)
      console.log(`    author: ${instagram.author || 'N/A'}`)
      console.log(`    username: ${instagram.username || 'N/A'}`)
    }

    if (updatedBookmark.blurb) {
      console.log(`\n  Blurb:`)
      console.log(`    "${updatedBookmark.blurb}"`)
    }

    if (updatedBookmark.extracted_resources?.length > 0) {
      console.log(`\n  Extracted Resources:`)
      updatedBookmark.extracted_resources.slice(0, 5).forEach((resource: any, i: number) => {
        console.log(`    ${i + 1}. ${resource.name}${resource.description ? ` - ${resource.description}` : ''}`)
      })
      if (updatedBookmark.extracted_resources.length > 5) {
        console.log(`    ... and ${updatedBookmark.extracted_resources.length - 5} more`)
      }
    }

    console.log('\n[REPROCESS] Done!')

  } catch (error) {
    console.error(`\n[REPROCESS] Error processing bookmark:`, error)
  }
}

// Get bookmark ID from command line args
const bookmarkId = process.argv[2]

if (!bookmarkId) {
  console.error('Usage: tsx test-reprocess-bookmark.ts <bookmark-id>')
  process.exit(1)
}

reprocessBookmark(bookmarkId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
