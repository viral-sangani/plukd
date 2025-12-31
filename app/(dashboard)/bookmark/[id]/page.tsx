import { getBookmarkById } from '@/lib/mock-data'
import { BookmarkDetailClient } from './bookmark-detail-client'

interface BookmarkPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function BookmarkPage({ params }: BookmarkPageProps) {
  const { id } = await params
  // Get initial bookmark data for SSR (fallback to mock data during development)
  const initialBookmark = getBookmarkById(id)

  return <BookmarkDetailClient id={id} initialBookmark={initialBookmark} />
}

export async function generateMetadata({ params }: BookmarkPageProps) {
  const { id } = await params
  const bookmark = getBookmarkById(id)

  if (!bookmark) {
    return {
      title: 'Bookmark Not Found - Plukd',
    }
  }

  return {
    title: `${bookmark.title} - Plukd`,
    description: bookmark.blurb,
  }
}
