import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Category, ContentSource, ProcessingStatus, Tag } from '@/types/database'
import { detectSource } from '@/lib/utils'
import { processBookmark } from '@/lib/processing/pipeline'

// GET /api/bookmarks - List bookmarks with filtering, pagination, and search
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const category = searchParams.get('category') as Category | null
    const source = searchParams.get('source') as ContentSource | null
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) as Tag[] | undefined
    const search = searchParams.get('search')
    const status = searchParams.get('status') as 'pending' | 'processing' | 'completed' | 'failed' | null
    const sortBy = (searchParams.get('sortBy') || 'created_at') as 'created_at' | 'title'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    // Build query
    let query = supabase
      .from('bookmarks')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    // Optionally filter by processing status (if not provided, return all bookmarks)
    if (status) {
      query = query.eq('processing_status', status)
    }

    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }

    if (source) {
      query = query.eq('source', source)
    }

    if (tags && tags.length > 0) {
      // Filter bookmarks that contain any of the specified tags
      query = query.overlaps('tags', tags)
    }

    if (search) {
      // Use full-text search on title, blurb, and summary
      query = query.textSearch('search_vector', search, {
        type: 'websearch',
        config: 'english'
      })
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: bookmarks, error, count } = await query

    if (error) {
      console.error('Error fetching bookmarks:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bookmarks' },
        { status: 500 }
      )
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      bookmarks: bookmarks || [],
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    })
  } catch (error) {
    console.error('Error in bookmarks API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/bookmarks - Create a new bookmark
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Create bookmark with pending status
    const bookmarkData = {
      user_id: user.id,
      url,
      source: detectSource(url) as ContentSource,
      title: url, // Placeholder, will be updated after processing
      blurb: '',
      summary: '',
      category: 'news-updates' as Category,
      tags: [] as Tag[],
      processing_status: 'pending' as ProcessingStatus,
    }

    const { data: bookmark, error: insertError } = await supabase
      .from('bookmarks')
      .insert(bookmarkData as never)
      .select('id, url')
      .single<{ id: string; url: string }>()

    if (insertError) {
      console.error('Error inserting bookmark:', insertError)
      return NextResponse.json(
        { error: 'Failed to create bookmark' },
        { status: 500 }
      )
    }

    // Trigger processing in the background (don't await)
    processBookmark(bookmark.id, bookmark.url).catch((err) => {
      console.error(`Failed to process bookmark ${bookmark.id}:`, err)
    })

    return NextResponse.json({
      success: true,
      bookmark: {
        id: bookmark.id,
        url: bookmark.url,
      },
      message: 'Bookmark saved. Processing will complete shortly.',
    })
  } catch (error) {
    console.error('Error creating bookmark:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
