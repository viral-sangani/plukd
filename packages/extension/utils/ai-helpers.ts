import { DEFAULT_TONE_PROMPTS, ENHANCED_TONE_PROMPTS, ToneType } from './prompts';
import { Settings, TweetContext, MediaItem } from './types';

interface PromptOptions {
    tone?: ToneType;
    includeEmoji?: boolean;
    additionalInstructions?: string;
}

export interface LabeledMedia {
    label: string;
    url: string;
    type: 'image' | 'video';
}

export interface PromptResult {
    prompt: string;
    labeledMedia: LabeledMedia[];
}

/**
 * Builds a strong system prompt with engagement best practices and tone-specific examples.
 * This sets the meta-level instructions for the AI model.
 */
export function buildSystemPrompt(tone: ToneType): string {
    const toneConfig = ENHANCED_TONE_PROMPTS[tone];

    let systemPrompt = `You are an expert Twitter user who writes authentic, engaging replies that start real conversations.

CORE PRINCIPLES:
- Be SPECIFIC to the tweet content - reference actual points made
- Start conversations, not just react with "Great post!" or generic praise
- Show genuine curiosity or add unique perspective
- Keep it conversational and natural, never robotic or AI-like
- Match the energy and context of the conversation

ENGAGEMENT TACTICS:
- Ask specific questions that show real interest
- Share relatable experiences or perspectives
- Use mild, thoughtful opinions (not bland agreement)
- Leave room for discussion and follow-up
- When appropriate, end with a question or hook for engagement

AVOID:
- Generic reactions ("This is so true!", "Amazing!", "Love this!")
- Robotic phrases ("As an AI", "I think", "In my opinion")
- Overly long paragraphs or rambling
- Hashtag spam
- Promotional language
- Repeating exactly what the tweet already said

TONE GUIDANCE: ${toneConfig.description}`;

    // Add few-shot examples for this tone
    if (toneConfig.examples && toneConfig.examples.length > 0) {
        systemPrompt += `\n\nEXAMPLES OF THIS TONE:\n${toneConfig.examples.join('\n\n')}`;
    }

    systemPrompt += `\n\nNow, write a reply following these principles and the ${tone} tone.`;

    return systemPrompt;
}

/**
 * Builds the AI prompt and collects labeled media from the entire thread.
 * Returns both the text prompt (with image labels) and an array of labeled media.
 */
export function buildAiPrompt(context: TweetContext | null, options: PromptOptions): PromptResult {
    const tone = options.tone || 'casual';
    const includeEmoji = options.includeEmoji !== false; // Default to true if not specified

    // Collect all media across the thread with labels
    const labeledMedia: LabeledMedia[] = [];
    let imageIndex = 1;

    // Helper to add media with labels
    const collectMedia = (media: MediaItem[] | undefined, source: string): string => {
        if (!media || media.length === 0) return '';
        const labels: string[] = [];
        for (const m of media) {
            if (m.type === 'image') {
                const label = `IMAGE_${imageIndex++}`;
                labeledMedia.push({ label, url: m.url, type: m.type });
                labels.push(label);
            } else if (m.type === 'video') {
                // Add video with label (AI will receive video poster/thumbnail URL)
                const label = `VIDEO_${imageIndex++}`;
                labeledMedia.push({ label, url: m.url, type: m.type });
                labels.push(label);
            }
        }
        return labels.length > 0 ? ` [Attached: ${labels.join(', ')}]` : '';
    };

    let prompt = '';

    if (context) {
        // Collect focal tweet media
        const focalMediaLabel = collectMedia(context.media, 'focal');

        prompt += `ORIGINAL TWEET CONTEXT (this is what you are replying to):
"${context.text}"${focalMediaLabel}
- Author: @${context.author || 'unknown'}
- Type: ${context.type}
`;

        // Add Thread History if available (parent tweets)
        if (context.thread && context.thread.length > 0) {
            const threadLines = context.thread.map(t => {
                const mediaLabel = collectMedia(t.media, 'thread');
                return `- @${t.author}: "${t.text}"${mediaLabel}`;
            });
            prompt += `
THREAD HISTORY (The conversation so far, leading up to the tweet above):
${threadLines.join('\n')}
`;
        }

        // Add Existing Replies if available (what others have already said)
        if (context.replies && context.replies.length > 0) {
            const replyLines = context.replies.map(r => {
                const mediaLabel = collectMedia(r.media, 'replies');
                return `- @${r.author}: "${r.text}"${mediaLabel}`;
            });
            prompt += `
EXISTING REPLIES (What others have said - avoid repeating these points):
${replyLines.join('\n')}
`;
        }

    } else {
        prompt += `Write a new tweet.`;
    }

    prompt += `
REQUIREMENTS:
1. Length: Short to medium length (vary naturally)
2. Tone: ${tone} (${DEFAULT_TONE_PROMPTS[tone] || 'natural and engaging'})
3. Human traits:
   - Use contractions (you're, don't, can't)
   - Variable punctuation (sometimes ..., sometimes !!)
   - ${includeEmoji ? 'Use 1-2 relevant emojis' : 'NO emojis'}
   - occasional lowercase start (20% chance) if casual
`;

    if (options.additionalInstructions) {
        prompt += `
ADDITIONAL INSTRUCTIONS/TOPIC:
${options.additionalInstructions}
`;
    }

    // Add media context note if there are labeled media
    if (labeledMedia.length > 0) {
        const hasImages = labeledMedia.some(m => m.type === 'image');
        const hasVideos = labeledMedia.some(m => m.type === 'video');

        let mediaTitle = 'ATTACHED MEDIA:';
        if (hasImages && !hasVideos) mediaTitle = 'ATTACHED IMAGES:';
        if (hasVideos && !hasImages) mediaTitle = 'ATTACHED VIDEOS:';

        prompt += `
${mediaTitle}
The following media is attached to this conversation. Reference them by their labels when relevant.
Labels: ${labeledMedia.map(m => m.label).join(', ')}
`;
    }

    prompt += `
CRITICAL RULES:
- MUST address specific points from the original tweet - show you actually read it
- Reply/write in the SAME LANGUAGE as the context/topic
- NO hashtags unless specifically asked
- NO "Here is a tweet:" prefixes or quotes around output
- Be authentic and conversational, never robotic
- Reference thread history, images, and videos when relevant
- Keep responses concise (aim for 1-3 sentences typically)
`;

    return { prompt, labeledMedia };
}
