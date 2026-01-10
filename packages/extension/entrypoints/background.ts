// import { defineBackground } from 'wxt/sandbox'; // Relying on auto-imports
import { browser } from 'wxt/browser';
import { settingsManager, usageStats } from '@/utils/storage';
import { apiClient } from '@/lib/api-client';
import { ToneType } from '@/utils/prompts';

// Define strict types for the request object
interface MediaItem {
    type: 'image' | 'video';
    url: string;
    base64?: string;
    mimeType?: string;
}

interface GenerateReplyRequest {
    action?: string;
    type?: string;
    tweetContent?: {
        text: string;
        author?: string;
        language?: string;
        type?: string;
    };
    prompt?: string;
    statsAction?: string;
    data?: any;
    media?: MediaItem[];
}

export default defineBackground(() => {
    console.log('X Auto Reply Extension background started (Vercel AI SDK Enabled)');

    // Service worker persistence
    let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

    function startKeepAlive() {
        if (keepAliveInterval) return;
        keepAliveInterval = setInterval(() => {
            // @ts-ignore
            browser.runtime.getPlatformInfo().then(() => { });
        }, 20000);
    }

    function stopKeepAlive() {
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
        }
    }

    // Handle startup
    browser.runtime.onStartup.addListener(() => {
        console.log('Extension started');
        startKeepAlive();
    });

    // Handle suspension
    browser.runtime.onSuspend.addListener(() => {
        console.log('Extension suspending');
        stopKeepAlive();
    });

    // Handle messages
    browser.runtime.onMessage.addListener((request: GenerateReplyRequest, sender, sendResponse) => {
        if (request.action === 'generateReply' || request.type === 'generateReply') {
            handleGenerateTweet(request, sendResponse); // Unified handler
            return true;
        } else if (request.action === 'openPopup') {
            browser.action.openPopup();
        } else if (request.action === 'recordStats') {
            handleRecordStats(request, sendResponse);
            return true;
        } else if (request.action === 'generateTweet' || request.type === 'generateTweet') {
            handleGenerateTweet(request, sendResponse);
            return true;
        }
    });

    // Extension icon click handler - opens settings page instead of popup
    browser.action.onClicked.addListener(async () => {
        await browser.runtime.openOptionsPage();
    });

    // Handle tweet generation (Unified for both Replying and Tweeting)
    async function handleGenerateTweet(request: GenerateReplyRequest, sendResponse: (response: any) => void) {
        try {
            const { prompt, media, tweetContent } = request;

            console.log('🚀 [BACKGROUND] Generation request received', {
                hasPrompt: !!prompt,
                hasMedia: !!media && media.length > 0,
                hasTweetContent: !!tweetContent
            });

            if (!prompt) {
                const error = 'Invalid request: No prompt provided';
                console.error('❌ [BACKGROUND]', error);
                throw new Error(error);
            }

            console.log('🚀 [BACKGROUND] Starting generation via Plukd API...');
            console.log('📋 [BACKGROUND] Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));

            const settings = await settingsManager.load();
            console.log('⚙️ [BACKGROUND] Settings loaded');

            // Get tone from settings
            const tone = (settings.tone || 'casual') as ToneType;

            // Create tweet context from the request
            // If tweetContent is provided, use it; otherwise create a basic context
            const tweetContext = tweetContent ? {
                text: tweetContent.text || '',
                author: tweetContent.author || null,
                language: tweetContent.language || 'en',
                type: tweetContent.type || 'tweet',
                hasMedia: (media && media.length > 0) || false,
                isThread: false,
                isReply: false,
                isVerified: false,
                mentions: [],
                hashtags: [],
                timestamp: null,
                media: media || []
            } : {
                text: prompt,
                author: null,
                language: 'en',
                type: 'tweet',
                hasMedia: (media && media.length > 0) || false,
                isThread: false,
                isReply: false,
                isVerified: false,
                mentions: [],
                hashtags: [],
                timestamp: null,
                media: media || []
            };

            console.log(`🔧 [BACKGROUND] Using tone: ${tone}`);
            console.log(`🔧 [BACKGROUND] Tweet context:`, {
                textLength: tweetContext.text.length,
                hasAuthor: !!tweetContext.author,
                language: tweetContext.language,
                type: tweetContext.type,
                hasMedia: tweetContext.hasMedia
            });

            // Call Plukd API to generate reply
            console.log('🌐 [BACKGROUND] Calling Plukd API...');
            const result = await apiClient.generateReply(
                tweetContext,
                tone,
                prompt,
                media
            );

            console.log('📥 [BACKGROUND] API response received:', {
                success: result.success,
                hasReply: !!result.reply,
                hasError: !!result.error
            });

            if (!result.success || !result.reply) {
                const errorMsg = result.error || 'Failed to generate reply';
                console.error('❌ [BACKGROUND] API call failed:', errorMsg);
                throw new Error(errorMsg);
            }

            console.log('✅ [BACKGROUND] Generation success');
            console.log('📝 [BACKGROUND] Raw reply:', result.reply.substring(0, 100) + (result.reply.length > 100 ? '...' : ''));

            const processedTweet = validateAndProcessReply(result.reply, settings);
            console.log('📝 [BACKGROUND] Processed reply:', processedTweet.substring(0, 100) + (processedTweet.length > 100 ? '...' : ''));

            // Validate reply quality
            const validation = validateReplyQuality(processedTweet);
            if (!validation.isValid) {
                console.warn('⚠️ [BACKGROUND] Quality issues detected:', validation.issues);
                // Note: We still return the reply but log warnings for monitoring
            }

            console.log('✅ [BACKGROUND] Successfully generated reply');

            sendResponse({ success: true, tweet: processedTweet, reply: processedTweet });

        } catch (error: any) {
            console.error('❌ [BACKGROUND] Generation error:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });

            // Send detailed error message to content script
            sendResponse({
                success: false,
                error: error.message || 'Failed to generate content. Please try again.'
            });
        }
    }

    async function handleRecordStats(request: GenerateReplyRequest, sendResponse: (response: any) => void) {
        try {
            const { statsAction, data } = request;
            if (statsAction) {
                await usageStats.record(statsAction, data);
            }
            sendResponse({ success: true });
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    // Validate reply quality - check for generic/robotic phrases
    function validateReplyQuality(reply: string): { isValid: boolean; issues: string[] } {
        const issues: string[] = [];

        // Check for generic praise phrases
        const genericPhrases = [
            /^(great|amazing|awesome|love this|so true)/i,
            /this is (so|really|very) (true|good|great|amazing)/i,
            /i (totally )?agree/i,
        ];

        if (genericPhrases.some(pattern => pattern.test(reply))) {
            issues.push('Contains generic praise phrase');
        }

        // Check for AI artifacts
        const aiPhrases = [
            /as an ai/i,
            /in my opinion/i,
            /i think that/i,
            /here is a/i
        ];

        if (aiPhrases.some(pattern => pattern.test(reply))) {
            issues.push('Contains AI-like phrasing');
        }

        // Check minimum engagement
        if (reply.length < 10) {
            issues.push('Reply too short to be meaningful');
        }

        return {
            isValid: issues.length === 0,
            issues
        };
    }

    function validateAndProcessReply(reply: string, settings: any) {
        let processedReply = reply.trim();
        const unwantedPatterns = [
            /^(Here's|Here is) (a|an|the) (reply|response|tweet):\s*/gi,
            /^(Reply|Response|Tweet):\s*/gi,
            /^I (would|will|can) (say|reply|respond):\s*/gi,
            /^(As an AI|As a language model|I'm an AI).*$/gim,
            /\n.*explanation.*$/gim,
            /\n.*note.*$/gim
        ];
        unwantedPatterns.forEach(pattern => {
            processedReply = processedReply.replace(pattern, '');
        });
        processedReply = processedReply.trim();
        if ((processedReply.startsWith('"') && processedReply.endsWith('"')) ||
            (processedReply.startsWith("'") && processedReply.endsWith("'"))) {
            processedReply = processedReply.slice(1, -1).trim();
        }
        if (settings.defaultText && settings.defaultText.trim()) {
            const defaultText = settings.defaultText.trim();
            const needsSpace = !processedReply.endsWith(' ') &&
                !defaultText.startsWith(' ') &&
                !defaultText.startsWith('#') &&
                !defaultText.startsWith('@');
            processedReply += (needsSpace ? ' ' : '') + defaultText;
        }
        return processedReply;
    }

    // TONE PROMPTS (Used by content script, kept here if reference needed, though main usage moved to buildAiPrompt in utils)
    // const TONE_PROMPTS: Record<string, string> = {
    //     casual: "Write like a real friend texting: use contractions (you're, don't, can't), sometimes start lowercase, add 1-2 natural emojis, casual abbreviations (ur, thx, bc), relaxed punctuation (..., !!), no corporate speak.",
    //     professional: "Business-appropriate but human: clear and concise, active voice, no emojis, avoid filler words, maintain professional respect while staying conversational and authentic.",
    //     humorous: "Naturally funny human: light jokes or wordplay, upbeat energy, maybe one emoji, self-deprecating humor okay, keep it clever and relatable, never forced or offensive.",
    //     formal: "Proper but human: correct grammar, no contractions, sophisticated vocabulary, neutral tone, no emojis, maintain dignity while being genuine and thoughtful.",
    //     'pro-plus': "Executive confidence: strong action words, results-focused, no emojis, brief and impactful, confident tone, avoid exclamation marks, sound like a seasoned professional.",
    //     academic: "Scholarly yet human: precise language, thoughtful analysis, hedging when appropriate (may, suggests), complex ideas simply expressed, no emojis, objective but engaging.",
    //     troll: "Playful roasting: witty sarcasm, eye-roll emoji 🙄, clever put-downs, challenge ideas not people, stay sharp and funny, never cruel or offensive.",
    //     bully: "Playful trash-talk: light teasing, absurd comparisons, clown emoji 🤡, poke fun at logic, keep it humorous, never cross into actual bullying or hate.",
    //     roasting: "Good-natured roasting: countryside humor, folksy metaphors, goat emoji 🐐, mock the idea playfully, stay funny and creative, never personal attacks."
    // };
});
