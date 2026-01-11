import type {
  OGMetadata,
  TwitterMetadata,
  RedditMetadata,
  YouTubeMetadata,
  LinkedInMetadata,
  InstagramMetadata,
  WebMetadata,
  RawMetadata,
} from '../../types'

// OpenGraph metadata samples

export const basicOGMetadata: OGMetadata = {
  title: 'Test Article Title',
  description: 'This is a test article description',
  image: 'https://example.com/og-image.jpg',
  siteName: 'Example Site',
  type: 'article',
  url: 'https://example.com/article',
}

export const minimalOGMetadata: OGMetadata = {
  title: 'Minimal OG',
}

export const maximalOGMetadata: OGMetadata = {
  title: 'Maximal OG Title',
  description: 'A comprehensive description with all fields',
  image: 'https://example.com/maximal-og-image.jpg',
  siteName: 'Maximal Site',
  type: 'article',
  url: 'https://example.com/maximal',
  locale: 'en_US',
  publishedTime: '2024-01-01T00:00:00Z',
  modifiedTime: '2024-01-02T00:00:00Z',
  author: 'John Doe',
  section: 'Technology',
}

// Platform-specific metadata samples

export const twitterMetadata: TwitterMetadata = {
  likes: 1500,
  retweets: 300,
  replies: 50,
  views: 50000,
  isThread: true,
  threadLength: 5,
}

export const minimalTwitterMetadata: TwitterMetadata = {
  likes: 0,
}

export const redditMetadata: RedditMetadata = {
  upvotes: 2500,
  downvotes: 100,
  score: 2400,
  comments: 150,
  community: 'r/programming',
  communityMembers: 5000000,
  isOP: true,
}

export const minimalRedditMetadata: RedditMetadata = {
  score: 1,
}

export const youtubeMetadata: YouTubeMetadata = {
  views: 1000000,
  likes: 50000,
  dislikes: 500,
  comments: 2000,
  duration: 'PT15M30S',
  channelSubscribers: 500000,
}

export const minimalYouTubeMetadata: YouTubeMetadata = {
  views: 0,
}

export const linkedinMetadata: LinkedInMetadata = {
  likes: 500,
  comments: 50,
  reposts: 25,
  impressions: 10000,
}

export const minimalLinkedInMetadata: LinkedInMetadata = {
  likes: 0,
}

export const instagramMetadata: InstagramMetadata = {
  likes: 5000,
  comments: 200,
  shares: 50,
  postType: 'post',
  caption: 'Check out this amazing content!',
}

export const instagramReelMetadata: InstagramMetadata = {
  likes: 10000,
  comments: 500,
  shares: 200,
  postType: 'reel',
  caption: 'Viral reel content',
}

export const minimalInstagramMetadata: InstagramMetadata = {
  likes: 0,
  postType: 'post',
}

export const webMetadata: WebMetadata = {
  readingTime: 8,
  wordCount: 1500,
  pageTitle: 'Blog Post Title',
}

export const minimalWebMetadata: WebMetadata = {
  wordCount: 0,
}

// Combined raw metadata samples

export const twitterRawMetadata: RawMetadata = {
  og: basicOGMetadata,
  twitter: twitterMetadata,
}

export const redditRawMetadata: RawMetadata = {
  og: basicOGMetadata,
  reddit: redditMetadata,
}

export const youtubeRawMetadata: RawMetadata = {
  og: basicOGMetadata,
  youtube: youtubeMetadata,
}

export const linkedinRawMetadata: RawMetadata = {
  og: basicOGMetadata,
  linkedin: linkedinMetadata,
}

export const instagramRawMetadata: RawMetadata = {
  og: basicOGMetadata,
  instagram: instagramMetadata,
}

export const webRawMetadata: RawMetadata = {
  og: basicOGMetadata,
  web: webMetadata,
}

// Edge case metadata

export const emptyMetadata: RawMetadata = {}

export const invalidMetadata: RawMetadata = {
  og: {
    title: '',
    description: '',
  },
  customField: 'invalid',
}

export const missingFieldsMetadata: RawMetadata = {
  og: {
    title: 'Only Title',
  },
  twitter: {
    likes: undefined,
    retweets: undefined,
  },
}
