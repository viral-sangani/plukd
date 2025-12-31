import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type BookmarkUpdate = Database['public']['Tables']['bookmarks']['Update']

// GET /api/bookmarks/[id] - Get a single bookmark
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch bookmark
    const { data: bookmark, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Bookmark not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching bookmark:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bookmark' },
        { status: 500 }
      )
    }

    return NextResponse.json(bookmark)
  } catch (error) {
    console.error('Error in bookmark API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/bookmarks/[id] - Update a bookmark
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Validate that the bookmark exists and belongs to the user
    const { error: fetchError } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('id', id)
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

    // Build update object with only allowed fields
    const updateData: BookmarkUpdate = {
      updated_at: new Date().toISOString()
    }

    // Allow updating these fields
    if (body.title !== undefined) updateData.title = body.title
    if (body.category !== undefined) updateData.category = body.category
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.blurb !== undefined) updateData.blurb = body.blurb
    if (body.summary !== undefined) updateData.summary = body.summary

    // Update bookmark
    const { data: updatedBookmark, error: updateError } = await supabase
      .from('bookmarks')
      .update(updateData as never)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating bookmark:', updateError)
      return NextResponse.json(
        { error: 'Failed to update bookmark' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedBookmark)
  } catch (error) {
    console.error('Error in bookmark update API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/bookmarks/[id] - Delete a bookmark
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete bookmark (RLS will ensure user can only delete their own)
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting bookmark:', error)
      return NextResponse.json(
        { error: 'Failed to delete bookmark' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in bookmark delete API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
