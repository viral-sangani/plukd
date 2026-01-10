import { SELECTORS, TWEET_TYPES, LANGUAGE_PATTERNS } from './constants';
import { TweetContext, MediaItem } from './types';

// Get current theme
export function getTwitterTheme(): 'dark' | 'light' {
    const isDark = document.documentElement.style.backgroundColor === 'rgb(0, 0, 0)' ||
        document.body.style.backgroundColor === 'rgb(0, 0, 0)' ||
        document.querySelector('[data-theme="dark"]') !== null ||
        document.documentElement.getAttribute('data-color-mode') === 'dark';
    return isDark ? 'dark' : 'light';
}

// Check if on mobile Twitter
export function isMobileTwitter(): boolean {
    return window.location.hostname === 'mobile.twitter.com' ||
        window.innerWidth < 768 ||
        document.querySelector('meta[name="viewport"][content*="width=device-width"]') !== null;
}

// Check if on X Pro
export function isXPro(): boolean {
    return window.location.hostname === 'pro.x.com';
}

// Get tweet ID from element
export function getTweetId(tweetElement: Element): string | null {
    const statusLink = tweetElement.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
    if (statusLink) {
        const match = statusLink.href.match(/\/status\/(\d+)/);
        return match ? match[1] : null;
    }

    // Fallback: try to get from parent elements
    let current: Element | null = tweetElement;
    while (current && current !== document.body) {
        const link = current.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
        if (link?.href) {
            const match = link.href.match(/\/status\/(\d+)/);
            if (match) return match[1];
        }
        current = current.parentElement;
    }

    return null;
}

// Check if element is in viewport
export function isInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Detect tweet language
export function detectTweetLanguage(tweetText: string): string {
    if (!tweetText) return 'en';

    // Check each language pattern
    for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
        if (pattern.test(tweetText)) {
            return lang;
        }
    }

    // Default to English
    return 'en';
}

// Get tweet author handle
export function getTweetAuthor(tweetElement: Element): string | null {
    const authorLink = tweetElement.querySelector(SELECTORS.tweetAuthor);
    if (authorLink) {
        const href = authorLink.getAttribute('href');
        return href ? href.substring(1) : null; // Remove leading '/'
    }
    return null;
}

// Check if tweet is a reply
export function isTweetReply(tweetElement: Element): boolean {
    const replyingTo = tweetElement.querySelector('div[dir] > span');
    return !!(replyingTo && replyingTo.textContent?.includes('Replying to'));
}

// Check if tweet is part of a thread
export function isTweetThread(tweetElement: Element): boolean {
    return !!tweetElement.querySelector(SELECTORS.threadLine) ||
        !!tweetElement.querySelector('[data-testid="tweet"] + [data-testid="tweet"]');
}

// Get tweet timestamp
export function getTweetTimestamp(tweetElement: Element): string | null {
    const timeElement = tweetElement.querySelector(SELECTORS.tweetTime);
    return timeElement ? timeElement.getAttribute('datetime') : null;
}

// Extract mentions from tweet
export function extractMentions(tweetElement: Element): string[] {
    const mentions: string[] = [];
    const textElement = tweetElement.querySelector(SELECTORS.tweetText);

    if (textElement) {
        const mentionLinks = textElement.querySelectorAll('a[href^="/"]');
        mentionLinks.forEach(link => {
            const text = link.textContent || '';
            if (text.startsWith('@')) {
                mentions.push(text);
            }
        });
    }

    return mentions;
}

// Extract hashtags from tweet
export function extractHashtags(tweetElement: Element): string[] {
    const hashtags: string[] = [];
    const textElement = tweetElement.querySelector(SELECTORS.tweetText);

    if (textElement) {
        const hashtagLinks = textElement.querySelectorAll('a[href*="/hashtag/"]');
        hashtagLinks.forEach(link => {
            if (link.textContent) {
                hashtags.push(link.textContent);
            }
        });
    }

    return hashtags;
}

// Check if tweet has media content
export function tweetHasMedia(tweetElement: Element): boolean {
    return !!(
        tweetElement.querySelector(SELECTORS.tweetPhoto) ||
        tweetElement.querySelector(SELECTORS.tweetVideo) ||
        tweetElement.querySelector(SELECTORS.tweetPoll) ||
        tweetElement.querySelector(SELECTORS.quoteTweet)
    );
}

// Get engagement metrics
export function getTweetEngagement(tweetElement: Element) {
    const engagement = {
        replies: 0,
        retweets: 0,
        likes: 0
    };

    // Extract reply count
    const replyButton = tweetElement.querySelector(SELECTORS.replyButton);
    if (replyButton && replyButton.textContent) {
        const replyText = replyButton.textContent.trim();
        const replyMatch = replyText.match(/(\d+)/);
        if (replyMatch) engagement.replies = parseInt(replyMatch[1]);
    }

    // Extract retweet count
    const retweetButton = tweetElement.querySelector(SELECTORS.retweetButton);
    if (retweetButton && retweetButton.textContent) {
        const retweetText = retweetButton.textContent.trim();
        const retweetMatch = retweetText.match(/(\d+)/);
        if (retweetMatch) engagement.retweets = parseInt(retweetMatch[1]);
    }

    // Extract like count
    const likeButton = tweetElement.querySelector(SELECTORS.likeButton);
    if (likeButton && likeButton.textContent) {
        const likeText = likeButton.textContent.trim();
        const likeMatch = likeText.match(/(\d+)/);
        if (likeMatch) engagement.likes = parseInt(likeMatch[1]);
    }

    return engagement;
}

// Classify tweet type based on content
export function classifyTweetType(tweetText: string, tweetElement: Element): string {
    if (!tweetText) return TWEET_TYPES.PERSONAL;

    const text = tweetText.toLowerCase();
    const hasMedia = tweetHasMedia(tweetElement);
    const isThread = isTweetThread(tweetElement);

    // Question detection
    if (text.includes('?') || text.match(/\b(what|how|why|when|where|who|which)\b/)) {
        return TWEET_TYPES.QUESTION;
    }

    // News detection
    if (text.match(/\b(breaking|news|report|announced|confirms|statement)\b/) ||
        hasMedia && text.match(/\b(video|photo|image|live)\b/)) {
        return TWEET_TYPES.NEWS;
    }

    // Educational detection
    if (text.match(/\b(learn|tutorial|guide|tip|how to|explain|understand)\b/) ||
        isThread) {
        return TWEET_TYPES.EDUCATIONAL;
    }

    // Humor detection
    if (text.match(/\b(lol|haha|😂|😄|😆|funny|joke|hilarious)\b/)) {
        return TWEET_TYPES.HUMOR;
    }

    // Opinion detection
    if (text.match(/\b(think|believe|opinion|feel|should|must|agree|disagree)\b/)) {
        return TWEET_TYPES.OPINION;
    }

    // Promotional detection
    if (text.match(/\b(buy|sale|discount|offer|launch|new|check out|link in bio)\b/)) {
        return TWEET_TYPES.PROMOTIONAL;
    }

    // Default to personal
    return TWEET_TYPES.PERSONAL;
}

// Get clean tweet text (removes UI elements)
export function getCleanTweetText(tweetElement: Element): string {
    const textElement = tweetElement.querySelector(SELECTORS.tweetText);
    if (!textElement || !textElement.textContent) return '';

    let text = textElement.textContent.trim();

    // Remove "Show this thread" and similar UI text
    text = text.replace(/Show this thread$/i, '').trim();
    text = text.replace(/^Show this thread\s*/i, '').trim();
    text = text.replace(/Translate Tweet$/i, '').trim();
    text = text.replace(/^Translate Tweet\s*/i, '').trim();

    return text;
}

// Check if user is verified
export function isVerifiedUser(tweetElement: Element): boolean {
    const verificationBadge = tweetElement.querySelector('[data-testid="icon-verified"]') ||
        tweetElement.querySelector('[aria-label*="Verified"]') ||
        tweetElement.querySelector('.verified');
    return !!verificationBadge;
}

// Escape special characters for regex
export function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Simple hash function
export function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// Generate unique identifier for tweet
export function generateTweetIdentifier(tweetElement: Element): string {
    const tweetId = getTweetId(tweetElement);
    if (tweetId) return `tweet_${tweetId}`;

    // Fallback: use text hash and position
    const text = getCleanTweetText(tweetElement);
    const hash = simpleHash(text);
    const tweets = document.querySelectorAll(SELECTORS.tweetArticle);
    const index = Array.from(tweets).indexOf(tweetElement);

    return `tweet_${hash}_${index}`;
}

// Check if current page is Twitter home timeline
export function isTwitterTimeline(): boolean {
    return window.location.pathname === '/home' ||
        window.location.pathname === '/' ||
        window.location.pathname === '/timeline';
}

// Check if current page is a tweet detail page
export function isTweetDetailPage(): boolean {
    return window.location.pathname.includes('/status/');
}

// Check if current page is a profile page
export function isProfilePage(): boolean {
    return !!(window.location.pathname.match(/^\/[^\/]+$/) &&
        !window.location.pathname.match(/^\/(home|explore|notifications|messages|bookmarks|lists|profile|settings)/));
}

// Get current page context
export function getPageContext(): 'timeline' | 'tweet_detail' | 'profile' | 'other' {
    if (isTwitterTimeline()) return 'timeline';
    if (isTweetDetailPage()) return 'tweet_detail';
    if (isProfilePage()) return 'profile';
    return 'other';
}

// Extract text nodes recursively to get clean text
function getTextNodes(element: Node): Node[] {
    let textNodes: Node[] = [];
    for (let node = element.firstChild; node; node = node.nextSibling) {
        if (node.nodeType === Node.TEXT_NODE) {
            textNodes.push(node);
        } else {
            textNodes = textNodes.concat(getTextNodes(node));
        }
    }
    return textNodes;
}

// Extract media (images and videos) from a tweet
export function extractTweetMedia(tweetElement: Element): MediaItem[] {
    const media: MediaItem[] = [];

    // Extract images from tweetPhoto containers
    const imageContainers = tweetElement.querySelectorAll('[data-testid="tweetPhoto"] img');
    imageContainers.forEach((img) => {
        const imgElement = img as HTMLImageElement;
        if (imgElement.src && imgElement.src.includes('pbs.twimg.com')) {
            media.push({
                type: 'image',
                url: imgElement.src
            });
        }
    });

    // Fallback: find any images that look like tweet media
    if (media.length === 0) {
        const allImages = tweetElement.querySelectorAll('img[src*="pbs.twimg.com/media"]');
        allImages.forEach((img) => {
            const imgElement = img as HTMLImageElement;
            media.push({
                type: 'image',
                url: imgElement.src
            });
        });
    }

    // Extract videos
    const videoContainers = tweetElement.querySelectorAll('[data-testid="videoPlayer"] video, video[poster*="pbs.twimg.com"]');
    videoContainers.forEach((video) => {
        const videoElement = video as HTMLVideoElement;
        // Use poster image or video src
        const url = videoElement.poster || videoElement.src || '';
        if (url) {
            media.push({
                type: 'video',
                url: url
            });
        }
    });

    return media;
}

/**
 * Helper to safely extract clean text and author from an article element
 */
function getTweetBasicInfo(article: Element) {
    const textElement = article.querySelector(SELECTORS.tweetText);
    let text = '';
    if (textElement) {
        const textNodes = getTextNodes(textElement);
        text = textNodes.map(node => node.textContent).join(' ').trim();
    }
    const author = getTweetAuthor(article) || 'unknown';
    return { author, text };
}

/**
 * Traverses UP the DOM from the focal tweet to find parent articles (thread history).
 * Returns array ordered from oldest to newest (top to bottom).
 */
export function extractThreadHistory(focalTweetElement: Element): { author: string; text: string; media?: MediaItem[]; }[] {
    const history: { author: string; text: string; media?: MediaItem[]; }[] = [];

    // We assume the thread container is a parent or grandparent. 
    // Usually all tweets in a conversation are siblings within a cell div, 
    // which are siblings within the primary column.

    // Strategy: Look at previous siblings of the focal tweet's container.
    // The focal tweet article is usually wrapped in a div, which is the sibling of other tweet divs.

    let currentContainer = focalTweetElement.closest('div[data-testid="cellInnerDiv"]') ||
        focalTweetElement.parentElement; // Fallback

    if (!currentContainer) return [];

    let sibling = currentContainer.previousElementSibling;
    while (sibling) {
        const article = sibling.querySelector('article[data-testid="tweet"]');
        if (article) {
            const info = getTweetBasicInfo(article);
            const media = extractTweetMedia(article);
            if (info.text) {
                history.unshift({ ...info, media: media.length > 0 ? media : undefined }); // Prepend to keep order: Oldest -> Newest
            }
        }
        sibling = sibling.previousElementSibling;
    }

    return history;
}

/**
 * Traverses DOWN from the reply composer to find existing replies.
 */
export function extractExistingReplies(focalTweetElement: Element, limit = 10): { author: string; text: string; media?: MediaItem[]; }[] {
    const replies: { author: string; text: string; media?: MediaItem[]; }[] = [];

    // Locate the reply composer which is usually 'Post your reply'
    // It's typically after the focal tweet.

    // First, find the container of the focal tweet
    let currentContainer = focalTweetElement.closest('div[data-testid="cellInnerDiv"]') ||
        focalTweetElement.parentElement;

    if (!currentContainer) return [];

    // Look for the "Post your reply" area to skip it
    // Usually it's a sibling further down.

    let sibling = currentContainer.nextElementSibling;

    // Scan siblings
    while (sibling && replies.length < limit) {
        // If we haven't passed the generic 'Post your reply' area, checks might be needed
        // but typically replies appear as valid tweets below.

        const article = sibling.querySelector('article[data-testid="tweet"]');
        if (article) {
            const info = getTweetBasicInfo(article);
            const media = extractTweetMedia(article);
            if (info.text) {
                replies.push({ ...info, media: media.length > 0 ? media : undefined });
            }
        }
        sibling = sibling.nextElementSibling;
    }

    return replies;
}

// Extract full tweet context
export function extractTweetContext(tweetElement: Element): TweetContext | null {
    // Ensure we are working with the tweet article
    const article = tweetElement.tagName === 'ARTICLE' ? tweetElement : tweetElement.closest(SELECTORS.tweetArticle);

    if (!article) return null;

    const textElement = article.querySelector(SELECTORS.tweetText);
    let text = '';

    if (textElement) {
        // Use recursive text node extraction for cleaner text
        const textNodes = getTextNodes(textElement);
        text = textNodes.map(node => node.textContent).join(' ').trim();
    }

    // Fallback if text extraction failed or was empty (e.g. image only tweet)
    if (!text && !tweetHasMedia(article)) {
        // Try getting aria-label or other content
        text = article.getAttribute('aria-label') || '';
    }

    // Extract media
    const media = extractTweetMedia(article);

    // Extract Thread & Replies (New Feature)
    const thread = extractThreadHistory(article);
    const replies = extractExistingReplies(article);

    return {
        text: text,
        author: getTweetAuthor(article),
        language: detectTweetLanguage(text),
        type: classifyTweetType(text, article),
        hasMedia: tweetHasMedia(article),
        isThread: isTweetThread(article),
        isReply: isTweetReply(article),
        isVerified: isVerifiedUser(article),
        mentions: extractMentions(article),
        hashtags: extractHashtags(article),
        timestamp: getTweetTimestamp(article),
        media: media,
        thread: thread,     // New
        replies: replies    // New
    };
}
