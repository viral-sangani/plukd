/**
 * Sample URLs for each platform and edge cases
 */

// Twitter/X URLs
export const twitterUrls = {
  standard: 'https://twitter.com/elonmusk/status/1234567890',
  xDomain: 'https://x.com/elonmusk/status/1234567890',
  withQuery: 'https://twitter.com/user/status/123456?s=20',
  thread: 'https://twitter.com/user/status/123456/thread',
  withHashtag: 'https://twitter.com/user/status/123456#reply',
  mobile: 'https://mobile.twitter.com/user/status/123456',
}

// Reddit URLs
export const redditUrls = {
  standard: 'https://reddit.com/r/programming/comments/abc123/best_practices',
  www: 'https://www.reddit.com/r/programming/comments/abc123',
  withQuery: 'https://reddit.com/r/programming/comments/abc123?utm_source=share',
  oldReddit: 'https://old.reddit.com/r/programming/comments/abc123',
  userProfile: 'https://reddit.com/user/username',
  subreddit: 'https://reddit.com/r/programming',
}

// YouTube URLs
export const youtubeUrls = {
  standard: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  short: 'https://youtu.be/dQw4w9WgXcQ',
  withTimestamp: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
  withPlaylist: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz',
  embed: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  mobile: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
  noWww: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  shortWithParams: 'https://youtu.be/dQw4w9WgXcQ?t=30',
}

// LinkedIn URLs
export const linkedinUrls = {
  post: 'https://www.linkedin.com/posts/johndoe_leadership-activity-123456',
  article: 'https://www.linkedin.com/pulse/article-title-author',
  profile: 'https://www.linkedin.com/in/johndoe',
  company: 'https://www.linkedin.com/company/company-name',
  withQuery: 'https://www.linkedin.com/posts/johndoe_leadership-activity-123456?utm_source=share',
}

// Instagram URLs
export const instagramUrls = {
  post: 'https://www.instagram.com/p/ABC123xyz/',
  reel: 'https://www.instagram.com/reel/ABC123xyz/',
  profile: 'https://www.instagram.com/username/',
  tv: 'https://www.instagram.com/tv/ABC123xyz/',
  stories: 'https://www.instagram.com/stories/username/123456789/',
  shortDomain: 'https://instagr.am/p/ABC123xyz/',
  withQuery: 'https://www.instagram.com/p/ABC123xyz/?igshid=abc',
}

// Web URLs
export const webUrls = {
  simple: 'https://example.com',
  withPath: 'https://example.com/blog/article',
  withQuery: 'https://example.com/page?param=value',
  withFragment: 'https://example.com/page#section',
  subdomain: 'https://blog.example.com/post',
  complexPath: 'https://example.com/category/subcategory/article-title',
  withPort: 'https://example.com:8080/page',
}

// Edge case URLs
export const edgeCaseUrls = {
  // Very long URL
  veryLong: `https://example.com/${'a'.repeat(2000)}`,

  // URL with special characters
  specialChars: 'https://example.com/article?title=Hello%20World&emoji=👋',

  // URL with multiple query parameters
  multipleParams:
    'https://example.com/page?param1=value1&param2=value2&param3=value3',

  // URL with encoded characters
  encoded: 'https://example.com/search?q=%E6%97%A5%E6%9C%AC%E8%AA%9E',

  // URL with international characters
  international: 'https://例え.jp/ページ',

  // URL with subdomain and path
  complexStructure: 'https://sub.domain.example.com/path/to/resource',

  // URL with authentication (should still work for detection)
  withAuth: 'https://user:pass@example.com/page',

  // URL with IP address
  ipAddress: 'https://192.168.1.1/page',

  // URL with localhost
  localhost: 'http://localhost:3000/page',

  // Data URL (edge case)
  dataUrl: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
}

// Invalid URLs (should return 'web' as fallback)
export const invalidUrls = {
  noProtocol: 'example.com/page',
  malformed: 'https:/example.com',
  empty: '',
  justProtocol: 'https://',
  spaces: 'https://example .com/page',
  invalidChars: 'https://example.com/<>page',
}

// All platform URLs in one object for easy iteration
export const allPlatformUrls = {
  twitter: twitterUrls.standard,
  xCom: twitterUrls.xDomain,
  reddit: redditUrls.standard,
  youtube: youtubeUrls.standard,
  youtubeShort: youtubeUrls.short,
  linkedin: linkedinUrls.post,
  instagram: instagramUrls.post,
  web: webUrls.simple,
}

// URLs for extractYouTubeVideoId tests
export const youtubeVideoIdTests = {
  valid: {
    standard: { url: youtubeUrls.standard, expected: 'dQw4w9WgXcQ' },
    short: { url: youtubeUrls.short, expected: 'dQw4w9WgXcQ' },
    withTimestamp: { url: youtubeUrls.withTimestamp, expected: 'dQw4w9WgXcQ' },
    shortWithParams: { url: youtubeUrls.shortWithParams, expected: 'dQw4w9WgXcQ' },
  },
  invalid: {
    noVideoId: 'https://www.youtube.com/feed/trending',
    notYoutube: 'https://example.com/watch?v=abc123',
    malformed: 'not-a-url',
  },
}

// URLs for extractTwitterPostId tests
export const twitterPostIdTests = {
  valid: {
    twitter: { url: twitterUrls.standard, expected: '1234567890' },
    xCom: { url: twitterUrls.xDomain, expected: '1234567890' },
    withQuery: { url: twitterUrls.withQuery, expected: '123456' },
  },
  invalid: {
    profile: 'https://twitter.com/username',
    noStatus: 'https://twitter.com/username/posts',
    malformed: 'not-a-url',
  },
}

// Text samples with URLs for extractUrls tests
export const textWithUrls = {
  single: 'Check out this link: https://example.com',
  multiple:
    'Here are two links: https://example.com and https://another.com',
  none: 'This text has no URLs',
  atStart: 'https://example.com is a great site',
  atEnd: 'Visit my website https://example.com',
  mixed:
    'Visit https://example.com or http://old-site.com for more info',
  withQuery:
    'Search here: https://example.com/search?q=test&page=1',
  withSpecialChars:
    'Link: https://example.com/path?param=hello%20world&other=value',
  multiline: `First line with https://example.com
Second line with https://another.com
Third line without URL`,
}
