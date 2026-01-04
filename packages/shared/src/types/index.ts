export type ContentSource = 'twitter' | 'reddit' | 'linkedin' | 'youtube' | 'instagram' | 'web'

export type Category =
  // Tech
  | 'ai'
  | 'machinelearning'
  | 'blockchain'
  | 'crypto'
  | 'defi'
  | 'web3'
  | 'devops'
  | 'cloud'
  | 'security'
  | 'mobile'
  | 'frontend'
  | 'backend'
  | 'databases'
  | 'apis'
  | 'programming'
  // Business
  | 'startups'
  | 'fundraising'
  | 'investing'
  | 'finance'
  | 'marketing'
  | 'sales'
  | 'growth'
  | 'product'
  | 'analytics'
  | 'saas'
  | 'enterprise'
  // Creative & Career
  | 'design'
  | 'ux'
  | 'career'
  | 'leadership'
  | 'productivity'
  | 'learning'
  // Industry
  | 'gaming'
  | 'hardware'
  | 'biotech'
  | 'ecommerce'
  // General
  | 'news'
  | 'other'

export type Tag =
  | 'tutorial'
  | 'guide'
  | 'opinion'
  | 'news'
  | 'tool'
  | 'resource'
  | 'video'
  | 'thread'
  | 'discussion'
  | 'announcement'
  | 'review'
  | 'comparison'
  | 'reference'
  | 'insight'
  | 'analysis'
  | 'showcase'
  | 'launch'
  | 'update'
  | 'research'
  | 'interview'

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

// Content type for AI classification
export type ContentType = 'thread' | 'article' | 'video' | 'discussion' | 'announcement' | 'list' | 'other'

// Resource layout hint for displaying extracted resources
export type ResourceLayoutHint =
  | 'numbered-steps'
  | 'grid'
  | 'accordion'
  | 'checklist'
  | 'cards'
  | 'table'
  | 'simple-list'

// Extracted resource from list-type content
export interface ExtractedResource {
  name: string
  description?: string
  url?: string
  category?: string // e.g., "book", "tool", "movie", "app"
}

export interface Bookmark {
  id: string
  user_id: string
  url: string
  source: ContentSource
  title: string
  author: string | null
  author_url: string | null
  content: string | null
  media_urls: string[] | null
  published_at: string | null
  category: Category
  tags: Tag[]
  blurb: string
  summary: string
  content_type: ContentType | null
  extracted_resources: ExtractedResource[] | null
  resource_layout_hint: ResourceLayoutHint | null
  processing_status: ProcessingStatus
  processing_error: string | null
  raw_metadata: Record<string, unknown> | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  telegram_chat_id: string | null
  telegram_username: string | null
  telegram_linked_at: string | null
  created_at: string
  updated_at: string
}

export interface TelegramLinkCode {
  id: string
  user_id: string
  code: string
  telegram_chat_id: string | null
  expires_at: string
  used_at: string | null
  created_at: string
}

// OpenGraph metadata structure
export interface OGMetadata {
  title?: string
  description?: string
  image?: string
  siteName?: string
  type?: string
  url?: string
  locale?: string
  publishedTime?: string
  modifiedTime?: string
  author?: string
  section?: string
}

// Source-specific metadata
export interface TwitterMetadata {
  likes?: number
  retweets?: number
  replies?: number
  views?: number
  isThread?: boolean
  threadLength?: number
}

export interface RedditMetadata {
  upvotes?: number
  downvotes?: number
  score?: number
  comments?: number
  community?: string
  communityMembers?: number
  isOP?: boolean
}

export interface YouTubeMetadata {
  views?: number
  likes?: number
  dislikes?: number
  comments?: number
  duration?: string
  channelSubscribers?: number
}

export interface LinkedInMetadata {
  likes?: number
  comments?: number
  reposts?: number
  impressions?: number
}

export interface InstagramMetadata {
  likes?: number
  comments?: number
  shares?: number
  postType?: 'post' | 'reel' | 'story'
  caption?: string
}

export interface WebMetadata {
  readingTime?: number
  wordCount?: number
  pageTitle?: string
}

// Combined raw metadata type
export interface RawMetadata {
  og?: OGMetadata
  twitter?: TwitterMetadata
  reddit?: RedditMetadata
  youtube?: YouTubeMetadata
  linkedin?: LinkedInMetadata
  instagram?: InstagramMetadata
  web?: WebMetadata
  [key: string]: unknown
}

export interface ExtractedContent {
  url: string
  source: ContentSource
  title: string
  author?: string
  authorUrl?: string
  content: string
  publishedAt?: Date
  mediaUrls?: string[]
  engagement?: {
    likes?: number
    comments?: number
    shares?: number
  }
  replies?: string[]
  transcript?: string
  transcriptLanguage?: string // Auto-detected language code from transcription
  rawMetadata?: RawMetadata
  // Open Graph metadata fields (extracted from web pages)
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogSiteName?: string
  ogType?: string
  // Standard meta tag fields
  metaDescription?: string
  metaAuthor?: string
  metaKeywords?: string
}

export interface ProcessingResult {
  category: Category
  tags: Tag[]
  blurb: string
  summary: string
  contentType: ContentType
  extractedResources?: ExtractedResource[]
  resourceLayoutHint?: ResourceLayoutHint
}

// API response types
export interface BookmarkCounts {
  total: number
  archived: number
  bySource: {
    twitter: number
    reddit: number
    youtube: number
    linkedin: number
    instagram: number
    web: number
  }
}

export interface BookmarkListResponse {
  bookmarks: Bookmark[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface BookmarkListParams {
  page?: number
  limit?: number
  category?: Category
  tags?: Tag[]
  source?: ContentSource
  search?: string
  archived?: boolean
  sortBy?: 'created_at' | 'title'
  sortOrder?: 'asc' | 'desc'
}
