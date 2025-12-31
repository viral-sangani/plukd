import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface BookmarkCounts {
  total: number
  bySource: {
    twitter: number
    reddit: number
    youtube: number
    linkedin: number
    web: number
  }
}

// GET /api/bookmarks/counts - Get bookmark counts by source
export async function GET() {
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

    // Get total count
    const { count: total, error: totalError } = await supabase
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (totalError) {
      console.error('Error fetching total count:', totalError)
      return NextResponse.json(
        { error: 'Failed to fetch counts' },
        { status: 500 }
      )
    }

    // Get counts by source using individual queries (Supabase doesn't support GROUP BY easily)
    const sources = ['twitter', 'reddit', 'youtube', 'linkedin', 'web'] as const
    const bySource: Record<string, number> = {}

    for (const source of sources) {
      const { count, error } = await supabase
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('source', source)

      if (error) {
        console.error(`Error fetching ${source} count:`, error)
        bySource[source] = 0
      } else {
        bySource[source] = count || 0
      }
    }

    const counts: BookmarkCounts = {
      total: total || 0,
      bySource: {
        twitter: bySource.twitter,
        reddit: bySource.reddit,
        youtube: bySource.youtube,
        linkedin: bySource.linkedin,
        web: bySource.web,
      }
    }

    return NextResponse.json(counts)
  } catch (error) {
    console.error('Error in counts API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
