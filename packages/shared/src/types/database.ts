// Database types for Supabase
// This matches the schema defined in plukd-spec.md

export type ContentSource = 'twitter' | 'reddit' | 'linkedin' | 'youtube' | 'web'

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

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
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
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar_url?: string | null
          telegram_chat_id?: string | null
          telegram_username?: string | null
          telegram_linked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          telegram_chat_id?: string | null
          telegram_username?: string | null
          telegram_linked_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bookmarks: {
        Row: {
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
          processing_status: ProcessingStatus
          processing_error: string | null
          raw_metadata: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          url: string
          source: ContentSource
          title: string
          author?: string | null
          author_url?: string | null
          content?: string | null
          media_urls?: string[] | null
          published_at?: string | null
          category: Category
          tags?: Tag[]
          blurb: string
          summary: string
          processing_status?: ProcessingStatus
          processing_error?: string | null
          raw_metadata?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          url?: string
          source?: ContentSource
          title?: string
          author?: string | null
          author_url?: string | null
          content?: string | null
          media_urls?: string[] | null
          published_at?: string | null
          category?: Category
          tags?: Tag[]
          blurb?: string
          summary?: string
          processing_status?: ProcessingStatus
          processing_error?: string | null
          raw_metadata?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
      }
      telegram_link_codes: {
        Row: {
          id: string
          user_id: string | null
          code: string
          telegram_chat_id: string | null
          telegram_username: string | null
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          code: string
          telegram_chat_id?: string | null
          telegram_username?: string | null
          expires_at: string
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          code?: string
          telegram_chat_id?: string | null
          telegram_username?: string | null
          expires_at?: string
          used_at?: string | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience types for use in components
export type User = Database['public']['Tables']['users']['Row']
export type Bookmark = Database['public']['Tables']['bookmarks']['Row']
export type TelegramLinkCode = Database['public']['Tables']['telegram_link_codes']['Row']

// API response types
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
  status?: ProcessingStatus
  sortBy?: 'created_at' | 'title'
  sortOrder?: 'asc' | 'desc'
}
