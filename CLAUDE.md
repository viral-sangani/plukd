# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plukd is a personal bookmarking application that allows users to save links via a Telegram bot, automatically categorize and summarize them with AI, and view them in a web interface. Domain: plukd.xyz

## Commands

```bash
# Development
pnpm dev              # Start Next.js dev server on http://localhost:3000

# Build & Lint
pnpm build            # Production build
pnpm lint             # Run ESLint

# Database
npx supabase db push  # Push migrations to Supabase
```

### Telegram Bot Local Testing
```bash
# Use ngrok for local webhook testing
ngrok http 3000

# The app has auto-webhook registration on startup (production only)
# For local dev, manually set webhook:
curl -X POST "http://localhost:3000/api/telegram/setup"
curl "http://localhost:3000/api/telegram/setup"  # Check status
```

## Architecture

### Two-Pass AI Processing Pipeline

The bookmark processing uses a two-pass AI architecture in `lib/ai/`:

1. **Pass 1 - Classification** (`gemini-3-flash-preview`): Fast model for categorization
   - Determines category (35 options), tags (20 options), and content type
   - Located in `lib/ai/process.ts:classifyContent()`

2. **Pass 2 - Summarization** (`gemini-3-pro-preview`): Higher quality model
   - Generates blurb (2-3 sentences) and detailed summary
   - Uses classification context from Pass 1
   - Located in `lib/ai/process.ts:summarizeContent()`

Few-shot examples are in `lib/ai/examples/` organized by content type.

### Content Extraction Flow

```
URL → detectSource() → Platform-specific extractor → AI Processing → Database
```

Extractors in `lib/extractors/`:
- `twitter.ts`, `reddit.ts`, `linkedin.ts` - Use Gopher API via `gopher-client.ts`
- `og-metadata.ts` - Fallback for web URLs
- Pipeline orchestration in `lib/processing/pipeline.ts`

### Telegram Bot Integration

- Bot handlers: `lib/telegram/bot.ts` (Grammy framework)
- Webhook management: `lib/telegram/webhook.ts`
- Webhook endpoint: `app/api/telegram/webhook/route.ts`
- Setup endpoint: `app/api/telegram/setup/route.ts`

The bot uses Grammy's `webhookCallback` with secret token verification. Account linking uses 6-digit codes stored in `telegram_link_codes` table.

### Route Groups

- `(auth)/` - Login page, auth callback (minimal layout)
- `(dashboard)/` - Main app with sidebar layout (requires auth)

### Data Flow

1. User sends link to Telegram bot
2. Bot saves bookmark with `processing_status: 'pending'`
3. `processBookmark()` runs in background (non-blocking)
4. Extraction → AI Processing → Database update
5. Frontend polls/refreshes to show processed content

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **Database/Auth**: Supabase (PostgreSQL + Auth)
- **AI**: Vercel AI SDK with Google Gemini models
- **Telegram**: Grammy
- **State Management**: TanStack Query

## Key Files

| Path | Purpose |
|------|---------|
| `lib/ai/process.ts` | Two-pass AI pipeline (classify → summarize) |
| `lib/processing/pipeline.ts` | Bookmark processing orchestration |
| `lib/telegram/bot.ts` | Telegram bot handlers |
| `lib/telegram/webhook.ts` | Webhook auto-registration |
| `lib/extractors/` | Platform-specific content extraction |
| `lib/constants.ts` | Categories (35), tags (20), source colors |
| `types/index.ts` | Core TypeScript types |
| `types/database.ts` | Supabase database types |
| `lib/validations/bookmark.ts` | Zod schemas for validation |

## Database

Supabase with Row Level Security (RLS). Key tables:
- `users` - User profiles with Telegram linking fields
- `bookmarks` - Saved links with AI-generated content
- `telegram_link_codes` - Temporary codes for account linking

Migrations in `supabase/migrations/`. Category column is TEXT (not enum) for flexibility.

## Design System

Cal.com-inspired dark theme. Key colors:
- Background: `#0a0a0a` (primary), `#111111` (secondary)
- Accent: `#22c55e` (green)
- Source colors: Twitter `#1da1f2`, Reddit `#ff4500`, YouTube `#ff0000`

Typography: Cal Sans for headings, Inter for body text.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
GOPHER_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```
