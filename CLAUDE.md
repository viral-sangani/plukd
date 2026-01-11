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

# Testing
pnpm test             # Run all tests across all packages
pnpm test:shared      # Run shared package tests
pnpm test:backend     # Run backend tests
pnpm test:frontend    # Run frontend tests
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage report

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

## Testing and Development Workflow

### Test-Driven Development (TDD)

**CRITICAL RULES:**
- **NEVER** implement features without tests first
- **ALWAYS** use the test-writer agent to generate comprehensive test cases before implementation
- **100% test coverage** is the goal; minimum thresholds:
  - Shared package: 100% (all metrics)
  - Backend: 80% statements, 75% branches, 85% functions
  - Frontend: 75% statements, 70% branches, 80% functions
- Features are **NOT COMPLETE** until all tests pass and coverage thresholds are met
- **NEVER** skip tests, even for "simple" changes
- **ALWAYS** fix broken tests immediately; never commit failing tests

### Parallel Agent Architecture

**Main Thread Responsibilities:**
- Manage TodoWrite task lists to track progress
- Coordinate parallel agents for maximum efficiency
- Synthesize agent results into actionable insights
- Communicate progress and results to user
- **NEVER** do complex exploration or implementation directly; delegate to specialized agents

**MANDATORY Parallel Agent Usage:**

#### 1. Exploration Tasks
**ALWAYS use Task tool with Explore agents (NEVER Grep/Glob/Read directly for exploration):**

- **Quick thoroughness** (1-2 files expected): Simple, targeted searches
- **Medium thoroughness** (3-10 files): Moderate complexity investigations
- **Very thorough thoroughness** (10+ files or cross-cutting concerns): Comprehensive analysis

**Launch 2-4 Explore agents in parallel** for comprehensive investigations of unfamiliar code areas.

**Examples:**
- ❌ BAD: Use Grep to search for "authentication flow"
- ✅ GOOD: Launch Explore agent with prompt "Investigate authentication flow implementation"
- ❌ BAD: Use Glob to find "all API routes"
- ✅ GOOD: Launch Explore agent with prompt "Map all API routes and their purposes"

#### 2. Feature Implementation Workflow
**ALWAYS follow this exact sequence:**

1. **Investigation Phase** (if needed):
   - Launch 2-4 Explore agents in parallel to understand existing code
   - Synthesize findings before proceeding

2. **Test Creation Phase** (MANDATORY):
   - Launch test-writer agent to create comprehensive test cases
   - Tests must cover: happy path, edge cases, error scenarios, integration points
   - Review test plan before implementation

3. **Implementation Phase**:
   - Launch senior-developer-generic agent to implement feature
   - Agent must run tests continuously during development
   - Agent must fix any test failures immediately
   - Agent must NOT declare complete until all tests pass

4. **Review Phase** (launch in parallel):
   - code-reviewer (patterns, consistency, security)
   - error-logging-auditor (error handling consistency)
   - security-auditor (vulnerabilities, sensitive data)
   - pr-test-analyzer (test coverage quality)

5. **Verification Phase**:
   - Run full test suite (backend + frontend)
   - Check coverage reports (must meet thresholds)
   - Fix any regressions immediately

**Example Workflow:**
```
User: "Add Instagram Reels support"

✅ CORRECT:
1. Launch 2 Explore agents (Instagram extractor + AI integration)
2. Launch test-writer agent → creates tests for extraction, metadata, AI processing
3. Launch senior-developer agent → implements feature, runs tests continuously
4. Launch 3 review agents in parallel → code-reviewer, error-auditor, security-auditor
5. Verify coverage maintained at 80%+
6. Declare complete only when all tests pass

❌ INCORRECT:
1. Implement Instagram Reels extraction directly
2. Test manually with a few URLs
3. Declare complete without automated tests
```

#### 3. Code Review and Audits
**ALWAYS launch multiple review agents in parallel (never sequentially):**

For any significant code change or new feature, launch in a **single message**:
- **code-reviewer**: Checks adherence to project patterns and style guides
- **error-logging-auditor**: Validates error handling and logging consistency
- **security-auditor**: Identifies security vulnerabilities
- **pr-test-analyzer**: Reviews test coverage and quality
- **test-auditor**: Identifies untested code paths and missing edge cases

**Example:**
```
✅ GOOD: Launch all review agents in single message after implementation
❌ BAD: Launch code-reviewer, wait for result, then launch error-auditor, etc.
```

### Testing Standards

**Test File Organization:**
```
packages/[package]/
├── src/
│   ├── [module]/
│   │   ├── __tests__/
│   │   │   ├── [module].test.ts
│   │   │   └── [submodule].test.ts
│   │   └── [module].ts
│   └── ...
├── vitest.config.ts
└── package.json (with test scripts)
```

**Test Naming Convention:**
```typescript
describe('[Module/Component Name]', () => {
  describe('[function/method name]', () => {
    it('should [expected behavior]', () => {
      // Arrange, Act, Assert
    })

    it('should handle [edge case]', () => {
      // Edge case test
    })

    it('should throw error when [error condition]', () => {
      // Error handling test
    })
  })
})
```

**Required Test Categories:**
1. **Happy Path Tests**: Test primary functionality with valid inputs
2. **Edge Case Tests**: Boundary values, empty inputs, null/undefined
3. **Error Handling Tests**: Invalid inputs, API failures, database errors
4. **Integration Tests**: Multiple components working together
5. **Regression Tests**: Prevent previously fixed bugs from returning

**Mocking Strategy:**
- Mock all external services (Supabase, Telegram, Google AI, Redis)
- Use realistic test data from fixtures
- Prefer test utilities over inline mocks for reusability
- Mock time-dependent functions (Date.now(), setTimeout) for deterministic tests

### Coverage Requirements

**100% Coverage Required For:**
- Shared package (utilities, schemas, constants)
- Error handling branches in critical paths
- Authentication and authorization logic
- Data validation and sanitization
- Payment/financial operations (if any)

**Minimum Coverage Thresholds:**
- Backend critical paths: 100% (AI pipeline, processing, extraction)
- Backend overall: 80% statements, 75% branches, 85% functions
- Frontend hooks and complex components: 75%+
- Frontend overall: 75% statements, 70% branches, 80% functions

**Coverage Enforcement:**
- CI/CD blocks merges if coverage drops below thresholds
- Coverage reports generated on every test run
- Uncovered lines must be justified or covered

### When NOT to Use Parallel Agents

**Use direct tools for:**
- Reading a specific known file path (use Read tool)
- Writing/editing a single known file (use Write/Edit tools)
- Running a specific command (use Bash tool)
- Simple file pattern matching (use Glob for exact patterns like "*.config.ts")
- Creating/updating TodoWrite task lists

**Use agents for:**
- Exploring unfamiliar code areas
- Searching for concepts across multiple files
- Implementing features
- Writing comprehensive test suites
- Reviewing code quality

## Deployment

### Backend (Hetzner VPS)

**Stack:** PM2 + Redis + Caddy

```bash
# Start with PM2
cd packages/backend
pm2 start ecosystem.config.cjs

# Manage
pm2 status           # Check status
pm2 logs plukd-api   # View logs
pm2 reload plukd-api # Zero-downtime reload
pm2 stop plukd-api   # Stop
```

**Production URLs:**
- API: https://api.plukd.xyz
- Frontend: https://plukd.xyz

**Server Requirements:**
- Bun runtime
- Redis (localhost:6379)
- Caddy reverse proxy (auto HTTPS)
- PM2 process manager

### CI/CD

GitHub Actions deploys to Hetzner on push to `main` branch.
