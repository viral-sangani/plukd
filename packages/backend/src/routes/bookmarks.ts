import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../config/supabase'
import { enqueueBookmarkProcessing } from '../jobs/queue'
import {
  detectSource,
  type Category,
  type ContentSource,
  type Tag,
  type ProcessingStatus,
  type Database,
  categorySchema,
  contentSourceSchema,
  tagSchema,
  processingStatusSchema,
  updateBookmarkSchema,
} from '@plukd/shared'

type BookmarkInsert = Database['public']['Tables']['bookmarks']['Insert']
type BookmarkUpdate = Database['public']['Tables']['bookmarks']['Update']

export const bookmarksRoutes = new Hono()

// All routes require authentication
bookmarksRoutes.use('*', authMiddleware)

// Query params schema for list endpoint
const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: categorySchema.optional(),
  source: contentSourceSchema.optional(),
  tags: z.string().optional(), // comma-separated
  search: z.string().optional(),
  status: processingStatusSchema.optional(),
  sortBy: z.enum(['created_at', 'title']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// GET / - List bookmarks with filtering, pagination, and search
bookmarksRoutes.get('/', async (c) => {
  try {
    const user = c.get('user')
    const query = c.req.query()

    // Parse and validate query params
    const params = listQuerySchema.parse({
      page: query.page,
      limit: query.limit,
      category: query.category || undefined,
      source: query.source || undefined,
      tags: query.tags || undefined,
      search: query.search || undefined,
      status: query.status || undefined,
      sortBy: query.sortBy || 'created_at',
      sortOrder: query.sortOrder || 'desc',
    })

    // Parse tags from comma-separated string
    const parsedTags = params.tags
      ? (params.tags.split(',').filter(Boolean) as Tag[])
      : undefined

    // Build query
    let dbQuery = supabaseAdmin
      .from('bookmarks')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    // Apply filters
    if (params.status) {
      dbQuery = dbQuery.eq('processing_status', params.status)
    }

    if (params.category) {
      dbQuery = dbQuery.eq('category', params.category)
    }

    if (params.source) {
      dbQuery = dbQuery.eq('source', params.source)
    }

    if (parsedTags && parsedTags.length > 0) {
      // Filter bookmarks that contain any of the specified tags
      dbQuery = dbQuery.overlaps('tags', parsedTags)
    }

    if (params.search) {
      // Use full-text search on title, blurb, and summary
      dbQuery = dbQuery.textSearch('search_vector', params.search, {
        type: 'websearch',
        config: 'english',
      })
    }

    // Apply sorting
    dbQuery = dbQuery.order(params.sortBy, {
      ascending: params.sortOrder === 'asc',
    })

    // Apply pagination
    const offset = (params.page - 1) * params.limit
    dbQuery = dbQuery.range(offset, offset + params.limit - 1)

    const { data: bookmarks, error, count } = await dbQuery

    if (error) {
      console.error('[bookmarks] Error fetching bookmarks:', error)
      return c.json({ error: 'Failed to fetch bookmarks' }, 500)
    }

    const total = count || 0
    const totalPages = Math.ceil(total / params.limit)

    return c.json({
      bookmarks: bookmarks || [],
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid query parameters', details: error.issues }, 400)
    }
    console.error('[bookmarks] Error in list:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Create bookmark request schema
const createBookmarkSchema = z.object({
  url: z.string().url('Invalid URL format'),
})

// POST / - Create a new bookmark
bookmarksRoutes.post('/', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()

    // Validate request body
    const { url } = createBookmarkSchema.parse(body)

    // Create bookmark with pending status
    const bookmarkData: BookmarkInsert = {
      user_id: user.id,
      url,
      source: detectSource(url) as ContentSource,
      title: url, // Placeholder, will be updated after processing
      blurb: '',
      summary: '',
      category: 'news' as Category,
      tags: [] as Tag[],
      processing_status: 'pending' as ProcessingStatus,
    }

    const { data: bookmark, error: insertError } = await supabaseAdmin
      .from('bookmarks')
      .insert(bookmarkData as never)
      .select('id, url')
      .single<{ id: string; url: string }>()

    if (insertError) {
      console.error('[bookmarks] Error inserting bookmark:', insertError)
      return c.json({ error: 'Failed to create bookmark' }, 500)
    }

    // Enqueue for background processing
    await enqueueBookmarkProcessing(bookmark.id, bookmark.url, user.id)

    return c.json({
      success: true,
      bookmark: {
        id: bookmark.id,
        url: bookmark.url,
      },
      message: 'Bookmark saved. Processing will complete shortly.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || 'Invalid request' }, 400)
    }
    console.error('[bookmarks] Error creating bookmark:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /counts - Get bookmark counts by source
bookmarksRoutes.get('/counts', async (c) => {
  try {
    const user = c.get('user')

    // Get total count
    const { count: total, error: totalError } = await supabaseAdmin
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (totalError) {
      console.error('[bookmarks] Error fetching total count:', totalError)
      return c.json({ error: 'Failed to fetch counts' }, 500)
    }

    // Get counts by source using individual queries
    const sources = ['twitter', 'reddit', 'youtube', 'linkedin', 'web'] as const
    const bySource: Record<string, number> = {}

    for (const source of sources) {
      const { count, error } = await supabaseAdmin
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('source', source)

      if (error) {
        console.error(`[bookmarks] Error fetching ${source} count:`, error)
        bySource[source] = 0
      } else {
        bySource[source] = count || 0
      }
    }

    return c.json({
      total: total || 0,
      bySource: {
        twitter: bySource.twitter,
        reddit: bySource.reddit,
        youtube: bySource.youtube,
        linkedin: bySource.linkedin,
        web: bySource.web,
      },
    })
  } catch (error) {
    console.error('[bookmarks] Error in counts:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Process bookmark request schema
const processBookmarkSchema = z.object({
  bookmarkId: z.string().uuid('Invalid bookmark ID'),
})

// POST /process - Manual reprocessing of a bookmark
bookmarksRoutes.post('/process', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()

    // Validate request body
    const { bookmarkId } = processBookmarkSchema.parse(body)

    // Verify the bookmark exists and belongs to the user
    const { data: bookmark, error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id, url')
      .eq('id', bookmarkId)
      .eq('user_id', user.id)
      .single<{ id: string; url: string }>()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return c.json({ error: 'Bookmark not found' }, 404)
      }
      console.error('[bookmarks] Error fetching bookmark:', fetchError)
      return c.json({ error: 'Failed to fetch bookmark' }, 500)
    }

    // Reset processing status to pending before reprocessing
    const updateData: BookmarkUpdate = {
      processing_status: 'pending',
      processing_error: null,
    }
    const { error: updateError } = await supabaseAdmin
      .from('bookmarks')
      .update(updateData as never)
      .eq('id', bookmarkId)

    if (updateError) {
      console.error('[bookmarks] Error resetting bookmark status:', updateError)
      return c.json({ error: 'Failed to reset bookmark status' }, 500)
    }

    // Enqueue for background processing
    await enqueueBookmarkProcessing(bookmark.id, bookmark.url, user.id)

    return c.json({
      success: true,
      message: 'Processing triggered',
      bookmarkId: bookmark.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || 'Invalid request' }, 400)
    }
    console.error('[bookmarks] Error in process:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /:id - Get a single bookmark
bookmarksRoutes.get('/:id', async (c) => {
  try {
    const user = c.get('user')
    const id = c.req.param('id')

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return c.json({ error: 'Invalid bookmark ID' }, 400)
    }

    // Fetch bookmark
    const { data: bookmark, error } = await supabaseAdmin
      .from('bookmarks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Bookmark not found' }, 404)
      }
      console.error('[bookmarks] Error fetching bookmark:', error)
      return c.json({ error: 'Failed to fetch bookmark' }, 500)
    }

    return c.json(bookmark)
  } catch (error) {
    console.error('[bookmarks] Error in get:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PUT /:id - Update a bookmark
bookmarksRoutes.put('/:id', async (c) => {
  try {
    const user = c.get('user')
    const id = c.req.param('id')
    const body = await c.req.json()

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return c.json({ error: 'Invalid bookmark ID' }, 400)
    }

    // Validate that the bookmark exists and belongs to the user
    const { error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return c.json({ error: 'Bookmark not found' }, 404)
      }
      console.error('[bookmarks] Error fetching bookmark:', fetchError)
      return c.json({ error: 'Failed to fetch bookmark' }, 500)
    }

    // Build update object with only allowed fields
    const updateData: BookmarkUpdate = {
      updated_at: new Date().toISOString(),
    }

    // Validate and add allowed fields
    const validatedBody = updateBookmarkSchema.partial().safeParse(body)
    if (!validatedBody.success) {
      return c.json({ error: 'Invalid update data', details: validatedBody.error.issues }, 400)
    }

    const { title, category, tags, blurb, summary } = validatedBody.data

    if (title !== undefined) updateData.title = title
    if (category !== undefined) updateData.category = category
    if (tags !== undefined) updateData.tags = tags
    if (blurb !== undefined) updateData.blurb = blurb
    if (summary !== undefined) updateData.summary = summary

    // Update bookmark
    const { data: updatedBookmark, error: updateError } = await supabaseAdmin
      .from('bookmarks')
      .update(updateData as never)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('[bookmarks] Error updating bookmark:', updateError)
      return c.json({ error: 'Failed to update bookmark' }, 500)
    }

    return c.json(updatedBookmark)
  } catch (error) {
    console.error('[bookmarks] Error in update:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PATCH /:id - Update a bookmark (alias for PUT)
bookmarksRoutes.patch('/:id', async (c) => {
  try {
    const user = c.get('user')
    const id = c.req.param('id')
    const body = await c.req.json()

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return c.json({ error: 'Invalid bookmark ID' }, 400)
    }

    // Validate that the bookmark exists and belongs to the user
    const { error: fetchError } = await supabaseAdmin
      .from('bookmarks')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return c.json({ error: 'Bookmark not found' }, 404)
      }
      console.error('[bookmarks] Error fetching bookmark:', fetchError)
      return c.json({ error: 'Failed to fetch bookmark' }, 500)
    }

    // Build update object with only allowed fields
    const updateData: BookmarkUpdate = {
      updated_at: new Date().toISOString(),
    }

    // Validate and add allowed fields
    const validatedBody = updateBookmarkSchema.partial().safeParse(body)
    if (!validatedBody.success) {
      return c.json({ error: 'Invalid update data', details: validatedBody.error.issues }, 400)
    }

    const { title, category, tags, blurb, summary } = validatedBody.data

    if (title !== undefined) updateData.title = title
    if (category !== undefined) updateData.category = category
    if (tags !== undefined) updateData.tags = tags
    if (blurb !== undefined) updateData.blurb = blurb
    if (summary !== undefined) updateData.summary = summary

    // Update bookmark
    const { data: updatedBookmark, error: updateError } = await supabaseAdmin
      .from('bookmarks')
      .update(updateData as never)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('[bookmarks] Error updating bookmark:', updateError)
      return c.json({ error: 'Failed to update bookmark' }, 500)
    }

    return c.json(updatedBookmark)
  } catch (error) {
    console.error('[bookmarks] Error in patch:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /:id - Delete a bookmark
bookmarksRoutes.delete('/:id', async (c) => {
  try {
    const user = c.get('user')
    const id = c.req.param('id')

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return c.json({ error: 'Invalid bookmark ID' }, 400)
    }

    // Delete bookmark (user_id check ensures user can only delete their own)
    const { error } = await supabaseAdmin
      .from('bookmarks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[bookmarks] Error deleting bookmark:', error)
      return c.json({ error: 'Failed to delete bookmark' }, 500)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('[bookmarks] Error in delete:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
