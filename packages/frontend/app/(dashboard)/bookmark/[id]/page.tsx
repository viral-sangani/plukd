import { createAdminClient } from '@/lib/supabase/server'
import { BookmarkDetailClient } from './bookmark-detail-client'

interface BookmarkPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function BookmarkPage({ params }: BookmarkPageProps) {
  const { id } = await params
  return <BookmarkDetailClient id={id} />
}

export async function generateMetadata({ params }: BookmarkPageProps) {
  const { id } = await params

  try {
    const supabase = await createAdminClient()
    const { data: bookmark } = await supabase
      .from('bookmarks')
      .select('title, blurb')
      .eq('id', id)
      .single<{ title: string; blurb: string | null }>()

    if (!bookmark) {
      return {
        title: 'Bookmark - Plukd',
      }
    }

    return {
      title: `${bookmark.title} - Plukd`,
      description: bookmark.blurb || undefined,
    }
  } catch {
    return {
      title: 'Bookmark - Plukd',
    }
  }
}
