/**
 * Tone Prompts for X Auto Reply Assistant
 * Enhanced with examples and temperature settings
 */

export type ToneType =
    | 'casual'
    | 'professional'
    | 'humorous'
    | 'concise'
    | 'detailed'
    | 'friendly';

export interface ToneConfig {
    description: string;
    examples: string[];
    temperature: number;
}

export const ENHANCED_TONE_PROMPTS: Record<ToneType, ToneConfig> = {
    casual: {
        description: "Friendly, conversational friend - natural contractions, relaxed tone, genuine reactions",
        temperature: 0.85,
        examples: [
            "Original: 'Just shipped a new feature!'\nReply: 'ooh what's the feature? been following your project and this looks sick'",
            "Original: 'Why does debugging always take longer than expected?'\nReply: 'lol every time. spent 3 hours yesterday on a typo... found it at 2am 😅'"
        ]
    },
    professional: {
        description: "Business-appropriate but warm - clear, concise, respectful yet conversational",
        temperature: 0.65,
        examples: [
            "Original: 'Excited to announce our Series A!'\nReply: 'Congratulations on the milestone. What area are you most excited to invest in with this round?'",
            "Original: 'Remote work is killing company culture'\nReply: 'Interesting take. What specific cultural elements have you found most challenging to maintain remotely?'"
        ]
    },
    humorous: {
        description: "Witty and playful - light jokes, clever wordplay, self-aware humor without forcing it",
        temperature: 0.9,
        examples: [
            "Original: 'My code works but I don't know why'\nReply: 'the best kind of code. now don't touch it and nobody gets hurt'",
            "Original: 'Just spent 2 hours optimizing something that saves 2ms'\nReply: 'but those 2ms will compound over 10 billion requests and save you like... $3'"
        ]
    },
    concise: {
        description: "Brief and to the point - short responses, direct communication, no fluff",
        temperature: 0.7,
        examples: [
            "Original: 'Just shipped a new feature!'\nReply: 'Nice! What problem does it solve?'",
            "Original: 'Should I use TypeScript or JavaScript?'\nReply: 'TypeScript. Catches bugs early, better DX.'"
        ]
    },
    detailed: {
        description: "Thorough and comprehensive - well-explained responses, provides context, helpful elaboration",
        temperature: 0.75,
        examples: [
            "Original: 'How do you handle state in React?'\nReply: 'Depends on complexity. For local UI state, useState works great. For shared state across components, Context API is solid. For complex apps, I'd go with Zustand or Redux Toolkit. What's your use case?'",
            "Original: 'Is serverless worth it?'\nReply: 'It really depends on your workload. Serverless shines for unpredictable traffic and event-driven architectures. The auto-scaling and pay-per-use model can save money. But for steady, predictable loads, traditional servers might be more cost-effective. What kind of application are you building?'"
        ]
    },
    friendly: {
        description: "Warm and supportive - encouraging tone, positive energy, empathetic responses",
        temperature: 0.8,
        examples: [
            "Original: 'Finally fixed that bug after 6 hours!'\nReply: 'That's awesome! Those marathon debugging sessions can be brutal but so satisfying when you crack it. Well done! 🎉'",
            "Original: 'Feeling overwhelmed by all the new tech to learn'\nReply: 'I totally get that feeling. The tech landscape moves fast! Try picking one thing that excites you most and diving into that first. You don't need to learn everything at once. What area interests you most?'"
        ]
    }
};

// Keep legacy DEFAULT_TONE_PROMPTS for backward compatibility (extract description only)
export const DEFAULT_TONE_PROMPTS: Record<ToneType, string> = {
    casual: ENHANCED_TONE_PROMPTS.casual.description,
    professional: ENHANCED_TONE_PROMPTS.professional.description,
    humorous: ENHANCED_TONE_PROMPTS.humorous.description,
    concise: ENHANCED_TONE_PROMPTS.concise.description,
    detailed: ENHANCED_TONE_PROMPTS.detailed.description,
    friendly: ENHANCED_TONE_PROMPTS.friendly.description
};

export const TONE_LABELS: Record<ToneType, string> = {
    casual: 'Casual',
    professional: 'Professional',
    humorous: 'Humorous',
    concise: 'Concise',
    detailed: 'Detailed',
    friendly: 'Friendly'
};
