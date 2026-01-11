import type {
  Bookmark,
  Category,
  Tag,
  ContentSource,
  ProcessingStatus,
  ContentType,
  ExtractedResource,
  ResourceLayoutHint,
  KeyTakeaway,
} from '../../types'

/**
 * Factory function to create test bookmark data with optional overrides
 */
export function createTestBookmark(
  overrides: Partial<Bookmark> = {}
): Bookmark {
  const now = new Date().toISOString()

  return {
    id: 'bookmark-123',
    user_id: 'user-123',
    url: 'https://example.com/article',
    source: 'web',
    title: 'Test Article Title',
    author: 'John Doe',
    author_url: 'https://example.com/author/johndoe',
    content: 'This is the test article content.',
    media_urls: ['https://example.com/image.jpg'],
    published_at: now,
    category: 'programming',
    tags: ['tutorial', 'guide'],
    blurb: 'A short blurb about the article.',
    summary: 'A detailed summary of the article content.',
    content_type: 'article',
    extracted_resources: null,
    resource_layout_hint: null,
    key_takeaways: null,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: null,
    is_archived: false,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

// Sample bookmarks for each source

export const twitterBookmark: Bookmark = createTestBookmark({
  id: 'twitter-1',
  url: 'https://twitter.com/elonmusk/status/1234567890',
  source: 'twitter',
  title: 'Important announcement about Tesla',
  author: 'Elon Musk',
  author_url: 'https://twitter.com/elonmusk',
  content:
    'Exciting news about our new Tesla model. Thread incoming... 🚀',
  category: 'startups',
  tags: ['announcement', 'thread'],
  content_type: 'thread',
})

export const redditBookmark: Bookmark = createTestBookmark({
  id: 'reddit-1',
  url: 'https://reddit.com/r/programming/comments/abc123/best_practices',
  source: 'reddit',
  title: 'Best practices for clean code',
  author: 'u/coderX',
  author_url: 'https://reddit.com/user/coderX',
  content: 'Here are my top 10 tips for writing clean, maintainable code...',
  category: 'programming',
  tags: ['guide', 'discussion'],
  content_type: 'discussion',
})

export const youtubeBookmark: Bookmark = createTestBookmark({
  id: 'youtube-1',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  source: 'youtube',
  title: 'Learn React in 2024',
  author: 'Tech Channel',
  author_url: 'https://www.youtube.com/channel/UCxyz',
  content: 'Complete React tutorial for beginners...',
  category: 'frontend',
  tags: ['tutorial', 'video'],
  content_type: 'video',
  media_urls: ['https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'],
})

export const linkedinBookmark: Bookmark = createTestBookmark({
  id: 'linkedin-1',
  url: 'https://www.linkedin.com/posts/johndoe_leadership-activity-123456',
  source: 'linkedin',
  title: 'Leadership lessons from my career',
  author: 'Jane Smith',
  author_url: 'https://www.linkedin.com/in/janesmith',
  content: 'After 10 years in tech leadership, here are my key learnings...',
  category: 'leadership',
  tags: ['insight', 'career'],
  content_type: 'article',
})

export const instagramBookmark: Bookmark = createTestBookmark({
  id: 'instagram-1',
  url: 'https://www.instagram.com/p/ABC123xyz/',
  source: 'instagram',
  title: 'Amazing UI design showcase',
  author: '@designpro',
  author_url: 'https://www.instagram.com/designpro',
  content: 'Check out this stunning interface design...',
  category: 'design',
  tags: ['showcase', 'resource'],
  content_type: 'other',
  media_urls: ['https://instagram.com/p/ABC123xyz/media/?size=l'],
})

export const webBookmark: Bookmark = createTestBookmark({
  id: 'web-1',
  url: 'https://blog.example.com/post/ai-trends-2024',
  source: 'web',
  title: 'AI Trends to Watch in 2024',
  author: 'Tech Blog Team',
  author_url: 'https://blog.example.com/authors/team',
  content: 'An in-depth analysis of emerging AI technologies...',
  category: 'ai',
  tags: ['analysis', 'research'],
  content_type: 'article',
})

// Edge case bookmarks

export const minimalBookmark: Bookmark = createTestBookmark({
  id: 'minimal-1',
  url: 'https://example.com',
  source: 'web',
  title: 'Link from example.com',
  author: null,
  author_url: null,
  content: null,
  media_urls: null,
  published_at: null,
  category: 'other',
  tags: [],
  blurb: '',
  summary: '',
  content_type: null,
})

export const maximalBookmark: Bookmark = createTestBookmark({
  id: 'maximal-1',
  url: 'https://example.com/comprehensive-guide',
  source: 'web',
  title: 'The Ultimate Guide to Everything',
  author: 'Expert Author',
  author_url: 'https://example.com/expert',
  content: 'A' + 'very long content '.repeat(100),
  media_urls: Array.from({ length: 10 }, (_, i) => `https://example.com/img${i}.jpg`),
  published_at: new Date().toISOString(),
  category: 'learning',
  tags: ['tutorial', 'guide', 'resource', 'reference'],
  blurb: 'An extensive blurb covering all the key points of this comprehensive guide.',
  summary: 'A detailed summary that goes into great depth about all aspects of the topic.',
  content_type: 'list',
  extracted_resources: [
    {
      name: 'Resource 1',
      description: 'First resource',
      url: 'https://example.com/resource1',
      category: 'tool',
    },
    {
      name: 'Resource 2',
      description: 'Second resource',
      url: 'https://example.com/resource2',
      category: 'book',
    },
  ] satisfies ExtractedResource[],
  resource_layout_hint: 'numbered-steps' satisfies ResourceLayoutHint,
  key_takeaways: [
    {
      text: 'First key takeaway',
      type: 'action',
    },
    {
      text: 'Second key takeaway',
      type: 'idea',
    },
  ] satisfies KeyTakeaway[],
  raw_metadata: {
    og: {
      title: 'OG Title',
      description: 'OG Description',
    },
  },
})

export const pendingBookmark: Bookmark = createTestBookmark({
  id: 'pending-1',
  processing_status: 'pending' satisfies ProcessingStatus,
  blurb: '',
  summary: '',
})

export const processingBookmark: Bookmark = createTestBookmark({
  id: 'processing-1',
  processing_status: 'processing' satisfies ProcessingStatus,
  blurb: '',
  summary: '',
})

export const failedBookmark: Bookmark = createTestBookmark({
  id: 'failed-1',
  processing_status: 'failed' satisfies ProcessingStatus,
  processing_error: 'Failed to extract content from URL',
  blurb: '',
  summary: '',
})

export const archivedBookmark: Bookmark = createTestBookmark({
  id: 'archived-1',
  is_archived: true,
})

// Bookmark with all categories (for testing category logic)
export const categorizedBookmarks: Record<Category, Bookmark> = {
  ai: createTestBookmark({ category: 'ai' }),
  machinelearning: createTestBookmark({ category: 'machinelearning' }),
  blockchain: createTestBookmark({ category: 'blockchain' }),
  crypto: createTestBookmark({ category: 'crypto' }),
  defi: createTestBookmark({ category: 'defi' }),
  web3: createTestBookmark({ category: 'web3' }),
  devops: createTestBookmark({ category: 'devops' }),
  cloud: createTestBookmark({ category: 'cloud' }),
  security: createTestBookmark({ category: 'security' }),
  mobile: createTestBookmark({ category: 'mobile' }),
  frontend: createTestBookmark({ category: 'frontend' }),
  backend: createTestBookmark({ category: 'backend' }),
  databases: createTestBookmark({ category: 'databases' }),
  apis: createTestBookmark({ category: 'apis' }),
  programming: createTestBookmark({ category: 'programming' }),
  startups: createTestBookmark({ category: 'startups' }),
  fundraising: createTestBookmark({ category: 'fundraising' }),
  investing: createTestBookmark({ category: 'investing' }),
  finance: createTestBookmark({ category: 'finance' }),
  marketing: createTestBookmark({ category: 'marketing' }),
  sales: createTestBookmark({ category: 'sales' }),
  growth: createTestBookmark({ category: 'growth' }),
  product: createTestBookmark({ category: 'product' }),
  analytics: createTestBookmark({ category: 'analytics' }),
  saas: createTestBookmark({ category: 'saas' }),
  enterprise: createTestBookmark({ category: 'enterprise' }),
  design: createTestBookmark({ category: 'design' }),
  ux: createTestBookmark({ category: 'ux' }),
  career: createTestBookmark({ category: 'career' }),
  leadership: createTestBookmark({ category: 'leadership' }),
  productivity: createTestBookmark({ category: 'productivity' }),
  learning: createTestBookmark({ category: 'learning' }),
  gaming: createTestBookmark({ category: 'gaming' }),
  hardware: createTestBookmark({ category: 'hardware' }),
  biotech: createTestBookmark({ category: 'biotech' }),
  ecommerce: createTestBookmark({ category: 'ecommerce' }),
  news: createTestBookmark({ category: 'news' }),
  other: createTestBookmark({ category: 'other' }),
}
