# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plukd is a personal bookmarking application that allows users to save links via a Telegram bot, automatically categorize and summarize them with AI, and view them in a web interface. Domain: plukd.xyz

## Monorepo Structure

This is a pnpm workspace monorepo with three packages:

```
plukd/
├── packages/
│   ├── backend/      # Express API server (port 3000)
│   ├── frontend/     # Next.js web app (port 3001)
│   └── shared/       # Shared types, constants, validations
├── supabase/         # Database migrations
└── pnpm-workspace.yaml
```

## Commands

```bash
# Development (from root)
pnpm dev              # Start both backend and frontend concurrently
pnpm dev:backend      # Start Express backend only (port 3000)
pnpm dev:frontend     # Start Next.js frontend only (port 3001)

# Build
pnpm build            # Build all packages
pnpm build:shared     # Build shared package (required before other builds)
pnpm build:backend    # Build backend only
pnpm build:frontend   # Build frontend only

# Lint
pnpm lint             # Lint all packages

# Database
npx supabase db push  # Push migrations to Supabase
```

### Telegram Bot Local Testing
```bash
# Use ngrok for local webhook testing (point to backend port)
ngrok http 3000

# The backend has auto-webhook registration on startup (production only)
# For local dev, manually set webhook:
curl -X POST "http://localhost:3000/api/telegram/setup"
curl "http://localhost:3000/api/telegram/setup"  # Check status
```

## Architecture

### Backend (Express API)

Located in `packages/backend/`. Handles:
- Telegram bot webhook and handlers
- Bookmark CRUD API endpoints
- AI processing pipeline
- Content extraction from URLs

Key directories:
- `src/routes/` - Express route handlers
- `src/services/` - Business logic (telegram, ai, extractors)
- `src/middleware/` - Auth and error handling
- `src/lib/` - Shared utilities

### Frontend (Next.js)

Located in `packages/frontend/`. Handles:
- Web UI with React components
- Supabase authentication
- TanStack Query for API data fetching

Key directories:
- `app/` - Next.js App Router pages
- `components/` - React components
- `lib/` - Frontend utilities, hooks, Supabase client

### Shared Package

Located in `packages/shared/`. Contains:
- TypeScript types (`types/`)
- Constants - categories, tags, colors (`constants.ts`)
- Zod validation schemas (`validations/`)

### Two-Pass AI Processing Pipeline

The bookmark processing uses a two-pass AI architecture:

1. **Pass 1 - Classification** (`gemini-3-flash-preview`): Fast model for categorization
   - Determines category (35 options), tags (20 options), and content type
   - Located in `packages/backend/src/services/ai/process.ts:classifyContent()`

2. **Pass 2 - Summarization** (`gemini-3-pro-preview`): Higher quality model
   - Generates blurb (2-3 sentences) and detailed summary
   - Uses classification context from Pass 1
   - Located in `packages/backend/src/services/ai/process.ts:summarizeContent()`

### Content Extraction Flow

```
URL → detectSource() → Platform-specific extractor → AI Processing → Database
```

Extractors in `packages/backend/src/services/extractors/`:
- `twitter.ts`, `reddit.ts`, `linkedin.ts` - Use Gopher API via `gopher-client.ts`
- `og-metadata.ts` - Fallback for web URLs
- Pipeline orchestration in `packages/backend/src/services/processing/pipeline.ts`

### Data Flow

1. User sends link to Telegram bot
2. Backend bot handler saves bookmark with `processing_status: 'pending'`
3. `processBookmark()` runs in background (non-blocking)
4. Extraction -> AI Processing -> Database update
5. Frontend polls/refreshes to show processed content

## Tech Stack

- **Backend**: Express.js with TypeScript
- **Frontend**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **Database/Auth**: Supabase (PostgreSQL + Auth)
- **AI**: Vercel AI SDK with Google Gemini models
- **Telegram**: Grammy
- **State Management**: TanStack Query
- **Build**: tsup for backend, pnpm workspaces

## Key Files

| Path | Purpose |
|------|---------|
| `packages/backend/src/services/ai/process.ts` | Two-pass AI pipeline |
| `packages/backend/src/services/processing/pipeline.ts` | Bookmark processing |
| `packages/backend/src/services/telegram/bot.ts` | Telegram bot handlers |
| `packages/backend/src/services/extractors/` | Content extraction |
| `packages/frontend/app/` | Next.js pages |
| `packages/frontend/components/` | React components |
| `packages/shared/src/constants.ts` | Categories, tags, colors |
| `packages/shared/src/types/` | TypeScript types |
| `packages/shared/src/validations/` | Zod schemas |

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

Typography: JetBrains Mono for headings, Inter for body text.

## Environment Variables

### Backend (`packages/backend/.env`)
```
PORT=3000
CORS_ORIGIN=http://localhost:3001
NODE_ENV=development

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
GOPHER_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

REDIS_URL=
APP_URL=
```

### Frontend (`packages/frontend/.env.local`)
```
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
