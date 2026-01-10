import { ToneType } from './prompts';

export interface AIProviderConfig {
    id: string;
    name: string;
    endpoint: string;
    model?: string;
    defaultModel?: string;
    generationConfig: {
        temperature: number;
        topK?: number;
        topP?: number;
        maxOutputTokens?: number;
        max_tokens?: number;
        stopSequences?: string[];
        candidateCount?: number;
        top_p?: number;
    };
    safetySettings?: {
        category: string;
        threshold: string;
    }[];
}

export interface Settings {
    enabled: boolean;
    provider: 'gemini' | 'openrouter' | 'openai' | 'deepseek' | 'claude' | 'perplexity';
    geminiKey?: string;
    openRouterKey?: string;
    openaiKey?: string;
    deepseekKey?: string;
    claudeKey?: string;
    perplexityKey?: string;
    openRouterModel: string;
    openRouterCustomModelName?: string;
    openaiModel: string;
    openaiCustomModelName?: string;
    deepseekModel: string;
    claudeModel: string;
    claudeCustomModelName?: string;
    // Removed minWords/maxWords
    defaultText: string;
    defaultHashtag?: string;
    includeEmoji: boolean;
    tone: ToneType;
    customTonePrompts?: Record<ToneType, string>;
    delayRange: string;
    typingSpeed: 'slow' | 'normal' | 'fast';
}

export interface UsageStatData {
    action: string;
    timestamp: string;
    [key: string]: any;
}

export interface DailyUsageStats {
    [action: string]: number | UsageStatData[] | undefined;
    data?: UsageStatData[];
}

export interface UsageStats {
    [date: string]: DailyUsageStats;
}

export interface MediaItem {
    type: 'image' | 'video';
    url: string;
    base64?: string;
    mimeType?: string;
}

export interface TweetContext {
    text: string;
    author: string | null;
    language: string;
    type: string;
    hasMedia: boolean;
    isThread: boolean;
    isReply: boolean;
    isVerified: boolean;
    mentions: string[];
    hashtags: string[];
    timestamp: string | null;
    media: MediaItem[];
    thread?: { author: string; text: string; media?: MediaItem[]; }[];
    replies?: { author: string; text: string; media?: MediaItem[]; }[];
}
