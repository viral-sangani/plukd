import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectSource,
  extractUrls,
  formatRelativeTime,
  formatDate,
  sleep,
  extractYouTubeVideoId,
  extractTwitterPostId,
  debounce,
  generateFallbackTitle,
  isTitleBad,
} from '../index'
import type { ContentSource } from '../../types'

// Import test fixtures
import {
  twitterUrls,
  redditUrls,
  youtubeUrls,
  linkedinUrls,
  instagramUrls,
  webUrls,
  edgeCaseUrls,
  invalidUrls,
  allPlatformUrls,
  youtubeVideoIdTests,
  twitterPostIdTests,
  textWithUrls,
} from '../../tests/fixtures/urls'

import {
  REFERENCE_DATE,
  REFERENCE_TIMESTAMP,
  justNow,
  twoMinutesAgo,
  thirtyMinutesAgo,
  fiftyNineMinutesAgo,
  oneHourAgo,
  twoHoursAgo,
  twelveHoursAgo,
  twentyThreeHoursAgo,
  oneDayAgo,
  twoDaysAgo,
  threeDaysAgo,
  sixDaysAgo,
  oneWeekAgo,
  twoWeeksAgo,
  threeWeeksAgo,
  oneMonthAgo,
  twoMonthsAgo,
  sixMonthsAgo,
  elevenMonthsAgo,
  oneYearAgo,
  twoYearsAgo,
  fiveYearsAgo,
  tenYearsAgo,
  oneMinuteInFuture,
  oneHourInFuture,
  oneDayInFuture,
  oneYearInFuture,
  epoch,
  leapYearDate,
  endOfYear,
  startOfYear,
  expectedRelativeTimeOutputs,
  expectedDateOutputs,
} from '../../tests/mocks/dates'

describe('Utility Functions', () => {
  describe('detectSource', () => {
    describe('Twitter/X detection', () => {
      it('should detect twitter.com URLs', () => {
        expect(detectSource(twitterUrls.standard)).toBe('twitter')
        expect(detectSource(twitterUrls.withQuery)).toBe('twitter')
        expect(detectSource(twitterUrls.mobile)).toBe('twitter')
      })

      it('should detect x.com URLs', () => {
        expect(detectSource(twitterUrls.xDomain)).toBe('twitter')
      })

      it('should handle case insensitivity', () => {
        expect(detectSource('https://TWITTER.COM/user/status/123')).toBe('twitter')
        expect(detectSource('https://X.COM/user/status/123')).toBe('twitter')
      })
    })

    describe('Reddit detection', () => {
      it('should detect reddit.com URLs', () => {
        expect(detectSource(redditUrls.standard)).toBe('reddit')
        expect(detectSource(redditUrls.www)).toBe('reddit')
        expect(detectSource(redditUrls.oldReddit)).toBe('reddit')
      })

      it('should detect user profiles and subreddits', () => {
        expect(detectSource(redditUrls.userProfile)).toBe('reddit')
        expect(detectSource(redditUrls.subreddit)).toBe('reddit')
      })
    })

    describe('YouTube detection', () => {
      it('should detect youtube.com URLs', () => {
        expect(detectSource(youtubeUrls.standard)).toBe('youtube')
        expect(detectSource(youtubeUrls.withTimestamp)).toBe('youtube')
        expect(detectSource(youtubeUrls.mobile)).toBe('youtube')
      })

      it('should detect youtu.be short URLs', () => {
        expect(detectSource(youtubeUrls.short)).toBe('youtube')
        expect(detectSource(youtubeUrls.shortWithParams)).toBe('youtube')
      })

      it('should detect embed URLs', () => {
        expect(detectSource(youtubeUrls.embed)).toBe('youtube')
      })
    })

    describe('LinkedIn detection', () => {
      it('should detect linkedin.com URLs', () => {
        expect(detectSource(linkedinUrls.post)).toBe('linkedin')
        expect(detectSource(linkedinUrls.article)).toBe('linkedin')
        expect(detectSource(linkedinUrls.profile)).toBe('linkedin')
        expect(detectSource(linkedinUrls.company)).toBe('linkedin')
      })
    })

    describe('Instagram detection', () => {
      it('should detect instagram.com URLs', () => {
        expect(detectSource(instagramUrls.post)).toBe('instagram')
        expect(detectSource(instagramUrls.reel)).toBe('instagram')
        expect(detectSource(instagramUrls.profile)).toBe('instagram')
      })

      it('should detect instagr.am short URLs', () => {
        expect(detectSource(instagramUrls.shortDomain)).toBe('instagram')
      })
    })

    describe('Web fallback detection', () => {
      it('should return web for generic URLs', () => {
        expect(detectSource(webUrls.simple)).toBe('web')
        expect(detectSource(webUrls.withPath)).toBe('web')
        expect(detectSource(webUrls.subdomain)).toBe('web')
      })

      it('should return web for unknown platforms', () => {
        expect(detectSource('https://unknown-platform.com/page')).toBe('web')
        expect(detectSource('https://example.org/article')).toBe('web')
      })
    })

    describe('Edge cases', () => {
      it('should handle invalid URLs gracefully', () => {
        expect(detectSource(invalidUrls.noProtocol)).toBe('web')
        expect(detectSource(invalidUrls.malformed)).toBe('web')
        expect(detectSource(invalidUrls.empty)).toBe('web')
        expect(detectSource(invalidUrls.justProtocol)).toBe('web')
      })

      it('should handle special characters in URLs', () => {
        expect(detectSource(edgeCaseUrls.specialChars)).toBe('web')
        expect(detectSource(edgeCaseUrls.encoded)).toBe('web')
      })

      it('should handle very long URLs', () => {
        expect(detectSource(edgeCaseUrls.veryLong)).toBe('web')
      })

      it('should handle localhost and IP addresses', () => {
        expect(detectSource(edgeCaseUrls.localhost)).toBe('web')
        expect(detectSource(edgeCaseUrls.ipAddress)).toBe('web')
      })
    })
  })

  describe('extractUrls', () => {
    describe('Basic URL extraction', () => {
      it('should extract single URL from text', () => {
        const urls = extractUrls(textWithUrls.single)
        expect(urls).toHaveLength(1)
        expect(urls[0]).toBe('https://example.com')
      })

      it('should extract multiple URLs from text', () => {
        const urls = extractUrls(textWithUrls.multiple)
        expect(urls).toHaveLength(2)
        expect(urls).toContain('https://example.com')
        expect(urls).toContain('https://another.com')
      })

      it('should return empty array when no URLs present', () => {
        const urls = extractUrls(textWithUrls.none)
        expect(urls).toHaveLength(0)
        expect(urls).toEqual([])
      })
    })

    describe('URL position in text', () => {
      it('should extract URL at start of text', () => {
        const urls = extractUrls(textWithUrls.atStart)
        expect(urls).toHaveLength(1)
        expect(urls[0]).toBe('https://example.com')
      })

      it('should extract URL at end of text', () => {
        const urls = extractUrls(textWithUrls.atEnd)
        expect(urls).toHaveLength(1)
        expect(urls[0]).toBe('https://example.com')
      })
    })

    describe('URL protocols', () => {
      it('should extract both http and https URLs', () => {
        const urls = extractUrls(textWithUrls.mixed)
        expect(urls).toHaveLength(2)
        expect(urls).toContain('https://example.com')
        expect(urls).toContain('http://old-site.com')
      })
    })

    describe('URLs with special characters', () => {
      it('should extract URLs with query parameters', () => {
        const urls = extractUrls(textWithUrls.withQuery)
        expect(urls).toHaveLength(1)
        expect(urls[0]).toContain('https://example.com/search?q=test&page=1')
      })

      it('should extract URLs with encoded characters', () => {
        const urls = extractUrls(textWithUrls.withSpecialChars)
        expect(urls).toHaveLength(1)
        expect(urls[0]).toContain('https://example.com/path')
      })
    })

    describe('Multiline text', () => {
      it('should extract URLs from multiline text', () => {
        const urls = extractUrls(textWithUrls.multiline)
        expect(urls).toHaveLength(2)
        expect(urls).toContain('https://example.com')
        expect(urls).toContain('https://another.com')
      })
    })

    describe('Edge cases', () => {
      it('should handle empty string', () => {
        expect(extractUrls('')).toEqual([])
      })

      it('should handle text with only whitespace', () => {
        expect(extractUrls('   \n\t  ')).toEqual([])
      })

      it('should handle text with partial URLs', () => {
        const urls = extractUrls('Visit example.com for more')
        expect(urls).toEqual([]) // No protocol, so not matched
      })
    })
  })

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      // Use fake timers and set system time to reference date
      vi.useFakeTimers()
      vi.setSystemTime(REFERENCE_DATE)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('Just now (< 1 minute)', () => {
      it('should return "just now" for dates less than 1 minute ago', () => {
        expect(formatRelativeTime(justNow)).toBe(expectedRelativeTimeOutputs.justNow)
      })

      it('should return "just now" for current time', () => {
        expect(formatRelativeTime(REFERENCE_DATE)).toBe('just now')
      })
    })

    describe('Minutes ago', () => {
      it('should format minutes correctly', () => {
        expect(formatRelativeTime(twoMinutesAgo)).toBe(expectedRelativeTimeOutputs.twoMinutesAgo)
        expect(formatRelativeTime(thirtyMinutesAgo)).toBe(expectedRelativeTimeOutputs.thirtyMinutesAgo)
        expect(formatRelativeTime(fiftyNineMinutesAgo)).toBe(expectedRelativeTimeOutputs.fiftyNineMinutesAgo)
      })
    })

    describe('Hours ago', () => {
      it('should format hours correctly', () => {
        expect(formatRelativeTime(oneHourAgo)).toBe(expectedRelativeTimeOutputs.oneHourAgo)
        expect(formatRelativeTime(twoHoursAgo)).toBe(expectedRelativeTimeOutputs.twoHoursAgo)
        expect(formatRelativeTime(twelveHoursAgo)).toBe(expectedRelativeTimeOutputs.twelveHoursAgo)
        expect(formatRelativeTime(twentyThreeHoursAgo)).toBe(expectedRelativeTimeOutputs.twentyThreeHoursAgo)
      })
    })

    describe('Days ago', () => {
      it('should format days correctly', () => {
        expect(formatRelativeTime(oneDayAgo)).toBe(expectedRelativeTimeOutputs.oneDayAgo)
        expect(formatRelativeTime(twoDaysAgo)).toBe(expectedRelativeTimeOutputs.twoDaysAgo)
        expect(formatRelativeTime(threeDaysAgo)).toBe(expectedRelativeTimeOutputs.threeDaysAgo)
        expect(formatRelativeTime(sixDaysAgo)).toBe(expectedRelativeTimeOutputs.sixDaysAgo)
      })
    })

    describe('Weeks ago', () => {
      it('should format weeks correctly', () => {
        expect(formatRelativeTime(oneWeekAgo)).toBe(expectedRelativeTimeOutputs.oneWeekAgo)
        expect(formatRelativeTime(twoWeeksAgo)).toBe(expectedRelativeTimeOutputs.twoWeeksAgo)
        expect(formatRelativeTime(threeWeeksAgo)).toBe(expectedRelativeTimeOutputs.threeWeeksAgo)
      })
    })

    describe('Months ago', () => {
      it('should format months correctly', () => {
        expect(formatRelativeTime(oneMonthAgo)).toBe(expectedRelativeTimeOutputs.oneMonthAgo)
        expect(formatRelativeTime(twoMonthsAgo)).toBe(expectedRelativeTimeOutputs.twoMonthsAgo)
        expect(formatRelativeTime(sixMonthsAgo)).toBe(expectedRelativeTimeOutputs.sixMonthsAgo)
        expect(formatRelativeTime(elevenMonthsAgo)).toBe(expectedRelativeTimeOutputs.elevenMonthsAgo)
      })
    })

    describe('Years ago', () => {
      it('should format years correctly', () => {
        expect(formatRelativeTime(oneYearAgo)).toBe(expectedRelativeTimeOutputs.oneYearAgo)
        expect(formatRelativeTime(twoYearsAgo)).toBe(expectedRelativeTimeOutputs.twoYearsAgo)
        expect(formatRelativeTime(fiveYearsAgo)).toBe(expectedRelativeTimeOutputs.fiveYearsAgo)
        expect(formatRelativeTime(tenYearsAgo)).toBe(expectedRelativeTimeOutputs.tenYearsAgo)
      })
    })

    describe('String date input', () => {
      it('should handle ISO string dates', () => {
        const isoString = twoMinutesAgo.toISOString()
        expect(formatRelativeTime(isoString)).toBe('2m ago')
      })
    })

    describe('Edge cases', () => {
      it('should handle future dates (show as just now)', () => {
        expect(formatRelativeTime(oneMinuteInFuture)).toBe('just now')
        expect(formatRelativeTime(oneHourInFuture)).toBe('just now')
        expect(formatRelativeTime(oneDayInFuture)).toBe('just now')
      })

      it('should handle very old dates', () => {
        expect(formatRelativeTime(epoch)).toContain('y ago')
      })
    })
  })

  describe('formatDate', () => {
    beforeEach(() => {
      // Use real timers for formatDate tests to avoid timezone issues
      vi.useRealTimers()
    })

    describe('Basic date formatting', () => {
      it('should format reference date correctly', () => {
        expect(formatDate(REFERENCE_DATE)).toBe(expectedDateOutputs.referenceDate)
      })

      it('should format start of year', () => {
        expect(formatDate(startOfYear)).toBe(expectedDateOutputs.startOfYear)
      })

      it('should format end of year', () => {
        expect(formatDate(endOfYear)).toBe(expectedDateOutputs.endOfYear)
      })

      it('should format epoch', () => {
        expect(formatDate(epoch)).toBe(expectedDateOutputs.epoch)
      })
    })

    describe('String date input', () => {
      it('should handle ISO string dates', () => {
        const isoString = REFERENCE_DATE.toISOString()
        expect(formatDate(isoString)).toBe('Jan 1, 2024')
      })
    })

    describe('Edge cases', () => {
      it('should handle leap year dates', () => {
        expect(formatDate(leapYearDate)).toBe(expectedDateOutputs.leapYearDate)
      })

      it('should handle different months', () => {
        expect(formatDate(new Date('2024-06-15'))).toBe('Jun 15, 2024')
        expect(formatDate(new Date('2024-12-25'))).toBe('Dec 25, 2024')
      })
    })
  })

  describe('sleep', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should resolve after specified milliseconds', async () => {
      const promise = sleep(1000)
      vi.advanceTimersByTime(1000)
      await expect(promise).resolves.toBeUndefined()
    })

    it('should handle different durations', async () => {
      const durations = [100, 500, 1000, 5000]

      for (const duration of durations) {
        const promise = sleep(duration)
        vi.advanceTimersByTime(duration)
        await expect(promise).resolves.toBeUndefined()
      }
    })

    it('should not resolve before specified time', async () => {
      let resolved = false
      const promise = sleep(1000).then(() => {
        resolved = true
      })

      vi.advanceTimersByTime(500)
      await Promise.resolve() // Flush microtasks
      expect(resolved).toBe(false)

      vi.advanceTimersByTime(500)
      await promise
      expect(resolved).toBe(true)
    })
  })

  describe('extractYouTubeVideoId', () => {
    describe('Standard youtube.com URLs', () => {
      it('should extract video ID from standard watch URL', () => {
        const result = extractYouTubeVideoId(youtubeVideoIdTests.valid.standard.url)
        expect(result).toBe(youtubeVideoIdTests.valid.standard.expected)
      })

      it('should extract video ID with timestamp', () => {
        const result = extractYouTubeVideoId(youtubeVideoIdTests.valid.withTimestamp.url)
        expect(result).toBe(youtubeVideoIdTests.valid.withTimestamp.expected)
      })

      it('should extract video ID with playlist', () => {
        const result = extractYouTubeVideoId(youtubeUrls.withPlaylist)
        expect(result).toBe('dQw4w9WgXcQ')
      })
    })

    describe('Short youtu.be URLs', () => {
      it('should extract video ID from short URL', () => {
        const result = extractYouTubeVideoId(youtubeVideoIdTests.valid.short.url)
        expect(result).toBe(youtubeVideoIdTests.valid.short.expected)
      })

      it('should extract video ID from short URL with params', () => {
        const result = extractYouTubeVideoId(youtubeVideoIdTests.valid.shortWithParams.url)
        expect(result).toBe(youtubeVideoIdTests.valid.shortWithParams.expected)
      })
    })

    describe('Invalid URLs', () => {
      it('should return null for non-YouTube URLs', () => {
        expect(extractYouTubeVideoId(youtubeVideoIdTests.invalid.notYoutube)).toBeNull()
      })

      it('should return null for YouTube URLs without video ID', () => {
        expect(extractYouTubeVideoId(youtubeVideoIdTests.invalid.noVideoId)).toBeNull()
      })

      it('should return null for malformed URLs', () => {
        expect(extractYouTubeVideoId(youtubeVideoIdTests.invalid.malformed)).toBeNull()
      })

      it('should return null for empty string', () => {
        expect(extractYouTubeVideoId('')).toBeNull()
      })
    })
  })

  describe('extractTwitterPostId', () => {
    describe('Valid Twitter URLs', () => {
      it('should extract post ID from twitter.com', () => {
        const result = extractTwitterPostId(twitterPostIdTests.valid.twitter.url)
        expect(result).toBe(twitterPostIdTests.valid.twitter.expected)
      })

      it('should extract post ID from x.com', () => {
        const result = extractTwitterPostId(twitterPostIdTests.valid.xCom.url)
        expect(result).toBe(twitterPostIdTests.valid.xCom.expected)
      })

      it('should extract post ID with query parameters', () => {
        const result = extractTwitterPostId(twitterPostIdTests.valid.withQuery.url)
        expect(result).toBe(twitterPostIdTests.valid.withQuery.expected)
      })
    })

    describe('Invalid URLs', () => {
      it('should return null for profile URLs without status', () => {
        expect(extractTwitterPostId(twitterPostIdTests.invalid.profile)).toBeNull()
      })

      it('should return null for URLs without status path', () => {
        expect(extractTwitterPostId(twitterPostIdTests.invalid.noStatus)).toBeNull()
      })

      it('should return null for malformed URLs', () => {
        expect(extractTwitterPostId(twitterPostIdTests.invalid.malformed)).toBeNull()
      })

      it('should extract post ID even from non-Twitter URLs with status path', () => {
        // The function doesn't validate if it's a Twitter URL, just extracts status ID
        expect(extractTwitterPostId('https://example.com/status/123')).toBe('123')
      })
    })
  })

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should debounce function calls', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 1000)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1000)

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should pass arguments correctly', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 1000)

      debouncedFn('arg1', 'arg2', 123)

      vi.advanceTimersByTime(1000)

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123)
    })

    it('should reset timer on each call', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 1000)

      debouncedFn()
      vi.advanceTimersByTime(500)

      debouncedFn()
      vi.advanceTimersByTime(500)

      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(500)

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should execute multiple times if delay passes between calls', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 1000)

      debouncedFn()
      vi.advanceTimersByTime(1000)
      expect(fn).toHaveBeenCalledTimes(1)

      debouncedFn()
      vi.advanceTimersByTime(1000)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should handle different delay values', () => {
      const fn = vi.fn()

      const debounced100 = debounce(fn, 100)
      debounced100()
      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)

      fn.mockClear()

      const debounced500 = debounce(fn, 500)
      debounced500()
      vi.advanceTimersByTime(500)
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('generateFallbackTitle', () => {
    describe('YouTube fallback titles', () => {
      it('should generate title with video ID', () => {
        const title = generateFallbackTitle(youtubeUrls.standard, 'youtube')
        expect(title).toBe('YouTube Video (dQw4w9WgXcQ)')
      })

      it('should generate generic title when video ID cannot be extracted', () => {
        const title = generateFallbackTitle('https://youtube.com/feed', 'youtube')
        expect(title).toBe('YouTube Video')
      })
    })

    describe('Twitter fallback titles', () => {
      it('should generate title with username', () => {
        const title = generateFallbackTitle(twitterUrls.standard, 'twitter')
        expect(title).toBe('Post by @elonmusk')
      })

      it('should generate title for x.com URLs', () => {
        const title = generateFallbackTitle(twitterUrls.xDomain, 'twitter')
        expect(title).toBe('Post by @elonmusk')
      })

      it('should generate generic title when username cannot be extracted', () => {
        const title = generateFallbackTitle('https://twitter.com', 'twitter')
        expect(title).toBe('Twitter/X Post')
      })
    })

    describe('Reddit fallback titles', () => {
      it('should generate title with subreddit', () => {
        const title = generateFallbackTitle(redditUrls.standard, 'reddit')
        expect(title).toBe('Reddit: r/programming')
      })

      it('should generate generic title when subreddit cannot be extracted', () => {
        const title = generateFallbackTitle('https://reddit.com', 'reddit')
        expect(title).toBe('Reddit Post')
      })
    })

    describe('LinkedIn fallback titles', () => {
      it('should generate title for posts', () => {
        const title = generateFallbackTitle(linkedinUrls.post, 'linkedin')
        expect(title).toBe('LinkedIn Post')
      })

      it('should generate title for articles', () => {
        const title = generateFallbackTitle(linkedinUrls.article, 'linkedin')
        expect(title).toBe('LinkedIn Article')
      })

      it('should generate generic title for other content', () => {
        const title = generateFallbackTitle(linkedinUrls.profile, 'linkedin')
        expect(title).toBe('LinkedIn Content')
      })
    })

    describe('Instagram fallback titles', () => {
      it('should generate title for reel with username', () => {
        const title = generateFallbackTitle('https://instagram.com/username/reel/abc', 'instagram')
        expect(title).toBe('Instagram Reel by @username')
      })

      it('should generate title for post with username', () => {
        const title = generateFallbackTitle('https://instagram.com/username/p/abc', 'instagram')
        expect(title).toBe('Instagram Post by @username')
      })

      it('should generate title for reel without username', () => {
        const title = generateFallbackTitle(instagramUrls.reel, 'instagram')
        expect(title).toBe('Instagram Reel')
      })

      it('should generate title for post without username', () => {
        const title = generateFallbackTitle(instagramUrls.post, 'instagram')
        expect(title).toBe('Instagram Post')
      })

      it('should generate title for profile with username', () => {
        const title = generateFallbackTitle(instagramUrls.profile, 'instagram')
        expect(title).toBe('Instagram Content by @username')
      })

      it('should generate generic title for stories', () => {
        // Stories path starts with 'stories' which is in the exclusion list
        const title = generateFallbackTitle(instagramUrls.stories, 'instagram')
        expect(title).toBe('Instagram Content')
      })

      it('should handle Instagram URLs with empty first path segment', () => {
        const title = generateFallbackTitle('https://instagram.com//p/abc', 'instagram')
        expect(title).toBe('Instagram Post')
      })
    })

    describe('Web fallback titles', () => {
      it('should generate title from path segment', () => {
        const title = generateFallbackTitle('https://example.com/blog/my-article', 'web')
        expect(title).toBe('example.com: My Article')
      })

      it('should handle dashes and underscores in path', () => {
        const title = generateFallbackTitle('https://example.com/some_great-article', 'web')
        expect(title).toBe('example.com: Some Great Article')
      })

      it('should remove file extensions', () => {
        const title = generateFallbackTitle('https://example.com/document.pdf', 'web')
        expect(title).toBe('example.com: Document')
      })

      it('should fallback to hostname when path is empty', () => {
        const title = generateFallbackTitle('https://example.com', 'web')
        expect(title).toBe('Link from example.com')
      })

      it('should fallback to hostname for very long path segments', () => {
        const longPath = 'a'.repeat(100)
        const title = generateFallbackTitle(`https://example.com/${longPath}`, 'web')
        expect(title).toBe('Link from example.com')
      })

      it('should remove www from hostname', () => {
        const title = generateFallbackTitle('https://www.example.com/article', 'web')
        expect(title).toBe('example.com: Article')
      })

      it('should handle web URLs with empty path segments', () => {
        const title = generateFallbackTitle('https://example.com///', 'web')
        expect(title).toBe('Link from example.com')
      })

      it('should handle web URLs with empty last path segment', () => {
        const title = generateFallbackTitle('https://example.com/path/', 'web')
        expect(title).toBe('example.com: Path')
      })
    })

    describe('Edge cases', () => {
      it('should handle malformed URLs gracefully', () => {
        const title = generateFallbackTitle('not-a-url', 'web')
        expect(title).toBe('Saved Link')
      })

      it('should handle empty URLs', () => {
        const title = generateFallbackTitle('', 'web')
        expect(title).toBe('Saved Link')
      })
    })
  })

  describe('isTitleBad', () => {
    describe('Empty and null titles', () => {
      it('should return true for null title', () => {
        expect(isTitleBad(null, 'https://example.com')).toBe(true)
      })

      it('should return true for undefined title', () => {
        expect(isTitleBad(undefined, 'https://example.com')).toBe(true)
      })

      it('should return true for empty string', () => {
        expect(isTitleBad('', 'https://example.com')).toBe(true)
      })

      it('should return true for whitespace-only string', () => {
        expect(isTitleBad('   ', 'https://example.com')).toBe(true)
      })
    })

    describe('Untitled variations', () => {
      it('should return true for "Untitled"', () => {
        expect(isTitleBad('Untitled', 'https://example.com')).toBe(true)
      })

      it('should return true for "untitled" (case insensitive)', () => {
        expect(isTitleBad('untitled', 'https://example.com')).toBe(true)
      })

      it('should return true for "UNTITLED"', () => {
        expect(isTitleBad('UNTITLED', 'https://example.com')).toBe(true)
      })
    })

    describe('Title matching URL', () => {
      it('should return true when title equals URL', () => {
        const url = 'https://example.com/article'
        expect(isTitleBad(url, url)).toBe(true)
      })

      it('should return true when title equals hostname', () => {
        expect(isTitleBad('example.com', 'https://example.com/article')).toBe(true)
      })

      it('should return true when title equals hostname with www', () => {
        expect(isTitleBad('www.example.com', 'https://www.example.com/article')).toBe(true)
      })
    })

    describe('Generic platform names', () => {
      it('should return true for "instagram"', () => {
        expect(isTitleBad('instagram', 'https://instagram.com/p/abc')).toBe(true)
      })

      it('should return true for "twitter"', () => {
        expect(isTitleBad('twitter', 'https://twitter.com/user/status/123')).toBe(true)
      })

      it('should return true for "reddit"', () => {
        expect(isTitleBad('reddit', 'https://reddit.com/r/programming')).toBe(true)
      })

      it('should return true for "linkedin"', () => {
        expect(isTitleBad('linkedin', 'https://linkedin.com/posts/user')).toBe(true)
      })

      it('should return true for "youtube"', () => {
        expect(isTitleBad('youtube', 'https://youtube.com/watch?v=abc')).toBe(true)
      })

      it('should be case insensitive for platform names', () => {
        expect(isTitleBad('Instagram', 'https://instagram.com/p/abc')).toBe(true)
        expect(isTitleBad('TWITTER', 'https://twitter.com/user/status/123')).toBe(true)
      })
    })

    describe('Instagram-specific bad patterns', () => {
      it('should return true for titles ending with "Follow on Instagram"', () => {
        expect(isTitleBad('Check this out Follow on Instagram', 'https://instagram.com/p/abc')).toBe(true)
      })

      it('should return true for titles starting with "Instagram photo by"', () => {
        expect(isTitleBad('Instagram photo by username', 'https://instagram.com/p/abc')).toBe(true)
      })

      it('should return true for titles starting with "Instagram video by"', () => {
        expect(isTitleBad('Instagram video by username', 'https://instagram.com/p/abc')).toBe(true)
      })

      it('should return true for titles starting with "Instagram reel by"', () => {
        expect(isTitleBad('Instagram Reel by username', 'https://instagram.com/reel/abc')).toBe(true)
      })

      it('should return true for titles ending with "on Instagram"', () => {
        expect(isTitleBad('Username on Instagram', 'https://instagram.com/p/abc')).toBe(true)
      })

      it('should return true for titles with "on Instagram:" and empty content', () => {
        expect(isTitleBad('Username on Instagram:', 'https://instagram.com/p/abc')).toBe(true)
        expect(isTitleBad('Username on Instagram: ""', 'https://instagram.com/p/abc')).toBe(true)
      })

      it('should return true for titles with "on Instagram:" and short content', () => {
        expect(isTitleBad('Username on Instagram: "Hi"', 'https://instagram.com/p/abc')).toBe(true)
      })

      it('should return false for titles with "on Instagram:" and meaningful content', () => {
        expect(isTitleBad(
          'Username on Instagram: "This is a meaningful caption about something interesting"',
          'https://instagram.com/p/abc'
        )).toBe(false)
      })

      it('should handle "on Instagram:" without capture group match', () => {
        // Edge case where regex matches but no capture group
        expect(isTitleBad('Username on Instagram: ', 'https://instagram.com/p/abc')).toBe(true)
      })
    })

    describe('Good titles', () => {
      it('should return false for descriptive titles', () => {
        expect(isTitleBad('How to Build a React App', 'https://example.com')).toBe(false)
      })

      it('should return false for titles with meaningful content', () => {
        expect(isTitleBad('10 Tips for Better Code', 'https://example.com')).toBe(false)
      })

      it('should return false for article titles', () => {
        expect(isTitleBad('Understanding JavaScript Closures', 'https://example.com')).toBe(false)
      })

      it('should return false for titles that contain platform name but are not just the platform name', () => {
        expect(isTitleBad('Twitter API Guide', 'https://example.com')).toBe(false)
        expect(isTitleBad('Instagram Marketing Tips', 'https://example.com')).toBe(false)
      })
    })

    describe('Edge cases', () => {
      it('should handle malformed URLs gracefully', () => {
        expect(isTitleBad('Good Title', 'not-a-url')).toBe(false)
      })

      it('should trim whitespace before checking', () => {
        expect(isTitleBad('  untitled  ', 'https://example.com')).toBe(true)
        expect(isTitleBad('  Good Title  ', 'https://example.com')).toBe(false)
      })
    })
  })
})
