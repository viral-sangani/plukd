# Plukd

A personal bookmarking application that saves links via Telegram bot, automatically categorizes and summarizes them with AI, and displays them in a modern web interface.

**Live:** [plukd.xyz](https://plukd.xyz)

## Features ok plukd.xyz

- **Telegram Bot Integration** - Save bookmarks by sending links to [@PlukdBot](https://t.me/PlukdBot)
- **AI-Powered Processing** - Automatic categorization, tagging, and summarization using Google Gemini
- **Multi-Source Extraction** - Supports Twitter/X, Reddit, LinkedIn, and general web pages
- **Full-Text Search** - Search across titles, summaries, URLs, categories, and tags
- **Smart Filtering** - Filter by source, category, status, and tags
- **Drag & Drop Reorder** - Organize bookmarks with custom ordering
- **Google OAuth** - Sign in with Google

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React, TailwindCSS, shadcn/ui |
| **Backend** | Express.js, Hono, BullMQ |
| **Database** | Supabase (PostgreSQL) |
| **AI** | Google Gemini (Flash + Pro) via Vercel AI SDK |
| **Extraction** | Gopher API (Twitter), Parallel AI (Web) |
| **Bot** | Grammy (Telegram) |
| **Runtime** | Bun |

## Project Structure

```
plukd/
├── packages/
│   ├── backend/      # Express API + Telegram bot (port 3000)
│   ├── frontend/     # Next.js web app (port 3001)
│   └── shared/       # Shared types, constants, validations
├── supabase/         # Database migrations
└── pnpm-workspace.yaml
```

## Getting Started

### Prerequisites

- Node.js 20+ or Bun
- pnpm
- Redis (for job queue)
- Supabase project
- API keys: Google AI, Telegram Bot, Gopher, Parallel AI

### Installation

```bash
# Clone the repository
git clone https://github.com/user/plukd.git
cd plukd

# Install dependencies
pnpm install

# Build shared package
pnpm build:shared
```

### Environment Variables

**Backend** (`packages/backend/.env`):
```env
PORT=3000
CORS_ORIGIN=http://localhost:3001
NODE_ENV=development

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
GOPHER_API_KEY=
PARALLEL_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

REDIS_URL=redis://localhost:6379
APP_URL=http://localhost:3000
```

**Frontend** (`packages/frontend/.env.local`):
```env
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Development

```bash
# Start both backend and frontend
pnpm dev

# Or run separately
pnpm dev:backend    # Express API on port 3000
pnpm dev:frontend   # Next.js on port 3001
```

### Build

```bash
pnpm build          # Build all packages
pnpm build:backend  # Build backend only
pnpm build:frontend # Build frontend only
```

## Architecture

### Two-Pass AI Processing

1. **Pass 1 - Classification** (Gemini Flash)
   - Determines category (35 options)
   - Assigns tags (20 options)
   - Identifies content type

2. **Pass 2 - Summarization** (Gemini Pro)
   - Generates TL;DR blurb (2-3 sentences)
   - Creates bullet-point summary with key insights

### Content Extraction Flow

```
URL → detectSource() → Platform Extractor → AI Processing → Database
                              │
                              ├── Twitter → Gopher API
                              ├── Reddit/LinkedIn/Web → Parallel AI
                              └── YouTube → Skipped
```

### Search Capabilities

Search queries match against:
- Title, blurb, summary, content (full-text search with ranking)
- URL (pattern matching)
- Category (pattern matching)
- Tags (exact match)

## Deployment

### Backend (Hetzner VPS)

Uses PM2 + Redis + Caddy:

```bash
cd packages/backend
pm2 start ecosystem.config.cjs
```

### Frontend (Vercel)

Deployed automatically via GitHub integration.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookmarks` | List bookmarks with filtering/search |
| POST | `/api/bookmarks` | Create new bookmark |
| GET | `/api/bookmarks/:id` | Get single bookmark |
| PUT | `/api/bookmarks/:id` | Update bookmark |
| DELETE | `/api/bookmarks/:id` | Delete bookmark |
| POST | `/api/bookmarks/process` | Reprocess bookmark |
| GET | `/api/bookmarks/counts` | Get counts by source |
| POST | `/api/telegram/webhook` | Telegram webhook |
| GET | `/api/telegram/link-status` | Check Telegram link status |

## License

MIT
