# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

X Auto Reply Assistant is a browser extension built with WXT (Web Extension Toolkit) that provides AI-powered reply generation for X/Twitter. The extension integrates with multiple AI providers (Gemini, OpenRouter, OpenAI, DeepSeek, Claude) to generate context-aware, human-like responses to tweets.

## Build & Development Commands

```bash
# Development
npm run dev              # Start development mode (Chrome)
npm run dev:firefox      # Start development mode (Firefox)

# Build & Release
npm run build           # Build production version
npm run zip             # Create distributable ZIP file

# Type Checking
npm run compile         # Run TypeScript type checking (no emit)

# Setup
npm run postinstall     # Prepare WXT (runs automatically after install)
```

## Architecture

### WXT Extension Structure

This is a WXT-based browser extension. WXT provides:
- Auto-imports for browser APIs and WXT utilities
- TypeScript support with path aliases
- React integration via `@wxt-dev/module-react`
- Automatic entrypoint detection

### Entrypoints

WXT entrypoints are in the `entrypoints/` directory:

- **`background.ts`**: Service worker that handles AI generation requests, manages extension lifecycle, and communicates with AI providers via the Vercel AI SDK
- **`twitter.content.ts`**: Content script injected into X/Twitter pages that monitors DOM, injects UI buttons, extracts tweet context, and handles user interactions
- **`popup/`**: Extension popup UI (React)
- **`options/`**: Extension options/settings page (React)

### Core Utilities (`utils/`)

- **`storage.ts`**: Secure storage wrapper with AES-GCM encryption for API keys. Contains `settingsManager`, `secureStorage`, `usageStats`, `cacheManager`, and `debugStorage`
- **`ai-helpers.ts`**: Builds AI prompts from tweet context. The `buildAiPrompt()` function collects media, thread history, and replies to create comprehensive prompts with labeled images (IMAGE_1, IMAGE_2, etc.)
- **`twitter-helpers.ts`**: DOM utilities for extracting tweet context, detecting language, identifying tweet types, and parsing thread structure
- **`types.ts`**: TypeScript interfaces for `Settings`, `TweetContext`, `MediaItem`, `AIProviderConfig`, etc.
- **`constants.ts`**: Configuration constants including DOM selectors, AI provider configs, error messages, and default settings
- **`prompts.ts`**: Tone definitions (`ToneType`) and default tone prompts for different reply styles (casual, professional, humorous, troll, bully, roasting)

### AI Provider Integration

The extension uses the Vercel AI SDK (`ai` package) with multiple providers:
- Google Gemini (`@ai-sdk/google`)
- OpenRouter (`@openrouter/ai-sdk-provider`)
- OpenAI (`@ai-sdk/openai`)
- DeepSeek (`@ai-sdk/deepseek`)
- Anthropic Claude (`@ai-sdk/anthropic`)

Provider initialization and text generation happens in `background.ts` using the `generateText()` function with `CoreMessage[]` format.

### Security & Storage

API keys are encrypted using Web Crypto API (AES-GCM with PBKDF2 key derivation) before being stored in browser.storage.local. The `secureStorage` utility handles encryption/decryption transparently. Settings are split: sensitive API keys are stored encrypted separately, while other settings are stored as plain objects.

### UI Components

React components using Radix UI primitives and Tailwind CSS with custom prefix (`tw-`):
- `components/ui/`: Shadcn-style components (Button, Dialog, Select, etc.)
- `components/PromptEditorDialog.tsx`: Custom tone prompt editor

Tailwind is configured with:
- Prefix: `tw-` to avoid conflicts with X/Twitter styles
- `preflight: false` to prevent CSS resets that break X/Twitter UI
- Custom Barlow font family
- HSL-based color system with CSS variables

### Tweet Context Extraction

The content script (`twitter.content.ts`) extracts rich context from tweets:
- Tweet text, author, timestamp, language
- Media attachments (images/videos) with base64 encoding
- Thread history (parent tweets leading to current tweet)
- Existing replies (to avoid duplication)
- Tweet type detection (question, news, opinion, etc.)

This context is passed to `buildAiPrompt()` which structures it for the AI provider.

## Key Patterns

### Content Script Injection

The content script uses MutationObserver to watch for new composer elements and polls as a fallback. Buttons are injected using a WeakSet to prevent duplicate injections. State is tracked in a `STATE` object to manage cleanup and prevent memory leaks.

### Message Passing

Content script → Background:
```typescript
browser.runtime.sendMessage({
  action: 'generateReply',
  prompt: string,
  media?: MediaItem[]
})
```

Background → Content script:
```typescript
// Response via sendResponse callback
{ success: true, reply: string }
// or
{ success: false, error: string }
```

### Settings Management

Load settings:
```typescript
const settings = await settingsManager.load();
```

Save settings (automatically encrypts API keys):
```typescript
await settingsManager.save(settings);
```

Get specific API key:
```typescript
const apiKey = await settingsManager.getApiKey('gemini');
```

### AI Prompt Building

```typescript
const { prompt, labeledMedia } = buildAiPrompt(context, {
  tone: 'casual',
  includeEmoji: true,
  additionalInstructions: 'Focus on XYZ...'
});
```

The function returns both the text prompt (with IMAGE_N labels) and an array of `labeledMedia` objects containing the actual image URLs and base64 data.

## Path Aliases

TypeScript path aliases defined in `tsconfig.json`:
- `@/*` → `./*` (project root)
- `@/components/*` → `./components/*`
- `@/lib/*` → `./lib/*`

## Important Notes

- WXT auto-imports mean you don't need to manually import `defineBackground`, `defineContentScript`, etc. - they're available globally
- Always use the `tw-` prefix for Tailwind classes to avoid conflicts
- The content script must handle dynamic DOM changes due to Twitter's SPA architecture
- Media attachments are converted to base64 for vision-capable AI models
- The extension uses browser.storage.local for persistence and browser.storage.session for caching
- TypeScript is configured with `noImplicitAny: false` for easier migration from JavaScript
