import type { Category, Tag, ContentSource } from '../types'

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
  web: 'bg-[#a1a1a1]',
}

export const SOURCE_TEXT_COLORS: Record<ContentSource, string> = {
  twitter: 'text-[#1da1f2]',
  reddit: 'text-[#ff4500]',
  linkedin: 'text-[#0077b5]',
  youtube: 'text-[#ff0000]',
  web: 'text-[#a1a1a1]',
}

export const SOURCE_LABELS: Record<ContentSource, string> = {
  twitter: 'X / Twitter',
  reddit: 'Reddit',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  web: 'Web',
}

export const SOURCE_ICONS: Record<ContentSource, string> = {
  twitter: 'Twitter',
  reddit: 'MessageCircle',
  linkedin: 'Linkedin',
  youtube: 'Youtube',
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
