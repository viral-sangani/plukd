import type { Category, Tag, ContentSource, ContentType, ResourceLayoutHint } from '../types'

export const CATEGORIES = [
  // Tech
  'ai',
  'machinelearning',
  'blockchain',
  'crypto',
  'defi',
  'web3',
  'devops',
  'cloud',
  'security',
  'mobile',
  'frontend',
  'backend',
  'databases',
  'apis',
  'programming',
  // Business
  'startups',
  'fundraising',
  'investing',
  'finance',
  'marketing',
  'sales',
  'growth',
  'product',
  'analytics',
  'saas',
  'enterprise',
  // Creative & Career
  'design',
  'ux',
  'career',
  'leadership',
  'productivity',
  'learning',
  // Industry
  'gaming',
  'hardware',
  'biotech',
  'ecommerce',
  // General
  'news',
  'other',
] as const satisfies readonly Category[]

export const CATEGORY_LABELS: Record<Category, string> = {
  // Tech
  ai: 'AI',
  machinelearning: 'Machine Learning',
  blockchain: 'Blockchain',
  crypto: 'Crypto',
  defi: 'DeFi',
  web3: 'Web3',
  devops: 'DevOps',
  cloud: 'Cloud',
  security: 'Security',
  mobile: 'Mobile',
  frontend: 'Frontend',
  backend: 'Backend',
  databases: 'Databases',
  apis: 'APIs',
  programming: 'Programming',
  // Business
  startups: 'Startups',
  fundraising: 'Fundraising',
  investing: 'Investing',
  finance: 'Finance',
  marketing: 'Marketing',
  sales: 'Sales',
  growth: 'Growth',
  product: 'Product',
  analytics: 'Analytics',
  saas: 'SaaS',
  enterprise: 'Enterprise',
  // Creative & Career
  design: 'Design',
  ux: 'UX',
  career: 'Career',
  leadership: 'Leadership',
  productivity: 'Productivity',
  learning: 'Learning',
  // Industry
  gaming: 'Gaming',
  hardware: 'Hardware',
  biotech: 'Biotech',
  ecommerce: 'E-commerce',
  // General
  news: 'Newspaper',
  other: 'MoreHorizontal',
}

export const CATEGORY_ICONS: Record<Category, string> = {
  // Tech
  ai: 'Brain',
  machinelearning: 'Cpu',
  blockchain: 'Blocks',
  crypto: 'Coins',
  defi: 'Landmark',
  web3: 'Globe',
  devops: 'Container',
  cloud: 'Cloud',
  security: 'Shield',
  mobile: 'Smartphone',
  frontend: 'Layout',
  backend: 'Server',
  databases: 'Database',
  apis: 'Plug',
  programming: 'Code2',
  // Business
  startups: 'Rocket',
  fundraising: 'HandCoins',
  investing: 'TrendingUp',
  finance: 'DollarSign',
  marketing: 'Megaphone',
  sales: 'BadgeDollarSign',
  growth: 'LineChart',
  product: 'Package',
  analytics: 'BarChart3',
  saas: 'CloudCog',
  enterprise: 'Building2',
  // Creative & Career
  design: 'Palette',
  ux: 'MousePointer2',
  career: 'Briefcase',
  leadership: 'Users',
  productivity: 'Zap',
  learning: 'BookOpen',
  // Industry
  gaming: 'Gamepad2',
  hardware: 'Cpu',
  biotech: 'Dna',
  ecommerce: 'ShoppingCart',
  // General
  news: 'Newspaper',
  other: 'MoreHorizontal',
}

export const TAGS = [
  'tutorial',
  'guide',
  'opinion',
  'news',
  'tool',
  'resource',
  'video',
  'thread',
  'discussion',
  'announcement',
  'review',
  'comparison',
  'reference',
  'insight',
  'analysis',
  'showcase',
  'launch',
  'update',
  'research',
  'interview',
] as const satisfies readonly Tag[]

export const TAG_LABELS: Record<Tag, string> = {
  tutorial: 'Tutorial',
  guide: 'Guide',
  opinion: 'Opinion',
  news: 'News',
  tool: 'Tool',
  resource: 'Resource',
  video: 'Video',
  thread: 'Thread',
  discussion: 'Discussion',
  announcement: 'Announcement',
  review: 'Review',
  comparison: 'Comparison',
  reference: 'Reference',
  insight: 'Insight',
  analysis: 'Analysis',
  showcase: 'Showcase',
  launch: 'Launch',
  update: 'Update',
  research: 'Research',
  interview: 'Interview',
}

export const SOURCE_COLORS: Record<ContentSource, string> = {
  twitter: 'bg-[#1da1f2]',
  reddit: 'bg-[#ff4500]',
  linkedin: 'bg-[#0077b5]',
  youtube: 'bg-[#ff0000]',
  instagram: 'bg-[#E4405F]',
  web: 'bg-[#a1a1a1]',
}

export const SOURCE_TEXT_COLORS: Record<ContentSource, string> = {
  twitter: 'text-[#1da1f2]',
  reddit: 'text-[#ff4500]',
  linkedin: 'text-[#0077b5]',
  youtube: 'text-[#ff0000]',
  instagram: 'text-[#E4405F]',
  web: 'text-[#a1a1a1]',
}

export const SOURCE_LABELS: Record<ContentSource, string> = {
  twitter: 'X / Twitter',
  reddit: 'Reddit',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  instagram: 'Instagram',
  web: 'Web',
}

export const SOURCE_ICONS: Record<ContentSource, string> = {
  twitter: 'Twitter',
  reddit: 'MessageCircle',
  linkedin: 'Linkedin',
  youtube: 'Youtube',
  instagram: 'Instagram',
  web: 'Globe',
}

export const PROCESSING_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
}

export const PROCESSING_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500',
  processing: 'bg-blue-500/10 text-blue-500',
  completed: 'bg-green-500/10 text-green-500',
  failed: 'bg-red-500/10 text-red-500',
}

// Content types for AI classification
export const CONTENT_TYPES = [
  'thread',
  'article',
  'video',
  'discussion',
  'announcement',
  'list',
  'other',
] as const satisfies readonly ContentType[]

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  thread: 'Thread',
  article: 'Article',
  video: 'Video',
  discussion: 'Discussion',
  announcement: 'Announcement',
  list: 'List',
  other: 'Other',
}

export const CONTENT_TYPE_DESCRIPTIONS: Record<ContentType, string> = {
  thread: 'Connected posts forming a narrative (Twitter threads, Reddit chains)',
  article: 'Long-form written content (blog posts, news, essays)',
  video: 'Video content (YouTube, Instagram Reels)',
  discussion: 'Comment-heavy content with multiple perspectives',
  announcement: 'Official news, releases, product launches',
  list: 'Curated collections of recommendations, resources, tools, books, movies',
  other: 'Tools, resources, reference material',
}

// Resource layout hints for displaying extracted resources
export const RESOURCE_LAYOUT_HINTS = [
  'numbered-steps',
  'grid',
  'accordion',
  'checklist',
  'cards',
  'table',
  'simple-list',
] as const satisfies readonly ResourceLayoutHint[]

export const RESOURCE_LAYOUT_HINT_LABELS: Record<ResourceLayoutHint, string> = {
  'numbered-steps': 'Numbered Steps',
  grid: 'Grid',
  accordion: 'Accordion',
  checklist: 'Checklist',
  cards: 'Cards',
  table: 'Table',
  'simple-list': 'Simple List',
}

export const RESOURCE_LAYOUT_HINT_DESCRIPTIONS: Record<ResourceLayoutHint, string> = {
  'numbered-steps': 'Sequential guides, step-by-step instructions',
  grid: 'Tools, products, visual collections',
  accordion: 'Content grouped by category',
  checklist: 'Actionable tips, to-do items',
  cards: 'Rich media content with images',
  table: 'Comparison data, structured information',
  'simple-list': 'Default list display',
}
