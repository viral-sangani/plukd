import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processBookmark } from '@/lib/processing/pipeline'

/**
 * POST /api/bookmarks/process
 *
 * Manually trigger reprocessing for a specific bookmark.
 * Useful for:
 * - Reprocessing failed bookmarks
 * - Admin/debug functionality
 * - Updating bookmarks after extractor improvements
 *
 * Request body:
 * {
 *   bookmarkId: string  // The UUID of the bookmark to reprocess
 * }
 *
 * Response:
 * - 200: Processing triggered successfully
 * - 400: Missing bookmarkId
 * - 401: Unauthorized
 * - 404: Bookmark not found
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { bookmarkId } = body

    if (!bookmarkId) {
      return NextResponse.json(
        { error: 'bookmarkId is required' },
        { status: 400 }
      )
    }

    // Verify the bookmark exists and belongs to the user
    const { data: bookmarkData, error: fetchError } = await supabase
      .from('bookmarks')
      .select('id, url')
      .eq('id', bookmarkId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Bookmark not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching bookmark:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch bookmark' },
        { status: 500 }
      )
    }

    const bookmark = bookmarkData as { id: string; url: string }

    // Reset processing status to pending before reprocessing
    const { error: updateError } = await supabase
      .from('bookmarks')
      .update({
        processing_status: 'pending',
        processing_error: null,
      } as never)
      .eq('id', bookmarkId)

    if (updateError) {
      console.error('Error resetting bookmark status:', updateError)
      return NextResponse.json(
        { error: 'Failed to reset bookmark status' },
        { status: 500 }
      )
    }

    // Trigger processing in the background (don't await)
    processBookmark(bookmark.id, bookmark.url).catch((err) => {
      console.error(`Failed to process bookmark ${bookmark.id}:`, err)
    })

    return NextResponse.json({
      success: true,
      message: 'Processing triggered',
      bookmarkId: bookmark.id,
    })
  } catch (error) {
    console.error('Error in process bookmark API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
