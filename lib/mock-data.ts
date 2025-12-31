import type { Bookmark, ContentSource, Category } from '@/types'

export const mockBookmarks: Bookmark[] = [
  {
    id: '1',
    user_id: 'user-1',
    url: 'https://twitter.com/dan_abramov/status/1876543210987654321',
    source: 'twitter',
    title: 'React 19 Server Components: A Deep Dive into the New Mental Model',
    author: 'Dan Abramov',
    author_url: 'https://twitter.com/dan_abramov',
    content: 'Thread: I want to explain how Server Components work and why we designed them this way...',
    media_urls: null,
    published_at: '2025-12-28T10:30:00Z',
    category: 'frontend',
    tags: ['thread', 'analysis', 'insight'],
    blurb: 'Dan Abramov breaks down the mental model behind React Server Components, explaining the "why" behind the architecture decisions and how to think about server vs client components.',
    summary: `Dan provides an in-depth explanation of React Server Components from first principles.

The key insight is that Server Components aren't just about performance - they represent a new way of thinking about component boundaries. The server/client split should be based on what each component needs to do, not where it renders.

He addresses common misconceptions, including the difference between SSR and Server Components. SSR sends HTML, but Server Components send a serialized React tree that can include client components as placeholders.

The thread concludes with practical guidance on when to use each type, emphasizing that most UI components should remain on the client while data-fetching and rendering-heavy components benefit from staying on the server.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: {
      og: {
        title: 'React 19 Server Components: A Deep Dive into the New Mental Model',
        description: 'Dan Abramov explains the architecture behind React Server Components and the new mental model for building apps.',
        image: 'https://pbs.twimg.com/profile_images/1336281436685541376/fRSl8uJP_400x400.jpg',
        siteName: 'X (formerly Twitter)',
      },
      twitter: {
        likes: 45200,
        retweets: 12500,
        replies: 1890,
        views: 2340000,
        isThread: true,
        threadLength: 24,
      },
    },
    created_at: '2025-12-28T08:00:00Z',
    updated_at: '2025-12-28T08:00:00Z',
  },
  {
    id: '2',
    user_id: 'user-1',
    url: 'https://www.youtube.com/watch?v=Tn6-PIqc4UM',
    source: 'youtube',
    title: 'Testing React Applications - The Complete Guide',
    author: 'Kent C. Dodds',
    author_url: 'https://youtube.com/@kentcdodds',
    content: null,
    media_urls: ['https://img.youtube.com/vi/Tn6-PIqc4UM/maxresdefault.jpg'],
    published_at: '2025-12-27T08:00:00Z',
    category: 'learning',
    tags: ['video', 'tutorial', 'guide'],
    blurb: 'Kent C. Dodds walks through his testing philosophy and demonstrates practical patterns for testing React components with Testing Library.',
    summary: `Kent shares his testing trophy approach and demonstrates real-world testing patterns.

The philosophy centers on testing user behavior rather than implementation details. Tests should resemble how users interact with the application, using queries like getByRole and getByText.

He demonstrates common patterns including mocking API calls, testing async operations, and handling complex user interactions. Each example emphasizes avoiding test code that would break during refactors.

The video concludes with integration testing strategies using Mock Service Worker, showing how to create maintainable test suites that give confidence without brittleness.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: {
      og: {
        title: 'Testing React Applications - The Complete Guide | Kent C. Dodds',
        description: 'Learn how to test React applications using Testing Library with practical patterns and real-world examples.',
        image: 'https://img.youtube.com/vi/Tn6-PIqc4UM/maxresdefault.jpg',
        siteName: 'YouTube',
        type: 'video.other',
        publishedTime: '2025-12-27T08:00:00Z',
      },
      youtube: {
        views: 156000,
        likes: 8900,
        comments: 423,
        duration: '1:24:35',
        channelSubscribers: 245000,
      },
    },
    created_at: '2025-12-27T10:30:00Z',
    updated_at: '2025-12-27T10:30:00Z',
  },
  {
    id: '3',
    user_id: 'user-1',
    url: 'https://www.youtube.com/watch?v=fireship-htmx',
    source: 'youtube',
    title: 'HTMX in 100 Seconds - Is This the Future of Web Dev?',
    author: 'Fireship',
    author_url: 'https://youtube.com/@Fireship',
    content: null,
    media_urls: ['https://img.youtube.com/vi/fireship-htmx/maxresdefault.jpg'],
    published_at: '2025-12-24T12:00:00Z',
    category: 'frontend',
    tags: ['video', 'news', 'update'],
    blurb: 'Fireship explains HTMX in his signature rapid-fire style, showing how it enables dynamic UIs without writing JavaScript.',
    summary: `A rapid overview of HTMX and its approach to building interactive web applications.

HTMX extends HTML with attributes that enable AJAX requests, CSS transitions, and WebSocket connections directly in markup. The philosophy is that HTML should be powerful enough to build modern UIs.

The video demonstrates common patterns like loading content dynamically, form submissions, and real-time updates. Each example shows how HTMX eliminates the need for client-side JavaScript frameworks in many scenarios.

The conclusion weighs the tradeoffs, noting HTMX excels for content-heavy applications but may not suit highly interactive SPAs requiring complex client state management.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: null,
    created_at: '2025-12-24T14:00:00Z',
    updated_at: '2025-12-24T14:00:00Z',
  },
  {
    id: '4',
    user_id: 'user-1',
    url: 'https://reddit.com/r/webdev/comments/tailwind-vs-css',
    source: 'reddit',
    title: 'Tailwind vs CSS Modules: A Year-Long Case Study',
    author: 'frontend_architect',
    author_url: 'https://reddit.com/u/frontend_architect',
    content: 'After using both approaches on different projects for a full year, here are my findings...',
    media_urls: null,
    published_at: '2025-12-26T15:45:00Z',
    category: 'design',
    tags: ['discussion', 'showcase', 'comparison'],
    blurb: 'A frontend architect shares a detailed comparison of Tailwind and CSS Modules after using both in production for a year, with metrics on bundle size, developer velocity, and maintenance burden.',
    summary: `The discussion presents data-driven insights from real production use of both styling approaches.

Tailwind showed faster initial development velocity, with designers and developers speaking the same language. However, the learning curve for new team members was steeper due to the utility-first paradigm.

CSS Modules provided better IDE support and easier debugging. The explicit class names made tracking down style issues straightforward, and the lack of build-time dependencies reduced complexity.

The conclusion suggests hybrid approaches work well: Tailwind for rapid prototyping and layout, CSS Modules for complex component-specific styles. The choice ultimately depends on team composition and project requirements.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: {
      og: {
        title: 'Tailwind vs CSS Modules: A Year-Long Case Study',
        description: 'After using both approaches on different projects for a full year, here are my findings with real metrics.',
        siteName: 'Reddit',
        type: 'article',
      },
      reddit: {
        upvotes: 2340,
        comments: 456,
        community: 'r/webdev',
        communityMembers: 2100000,
        score: 2156,
      },
    },
    created_at: '2025-12-26T18:00:00Z',
    updated_at: '2025-12-26T18:00:00Z',
  },
  {
    id: '5',
    user_id: 'user-1',
    url: 'https://linkedin.com/posts/reidhoffman/ai-future-work',
    source: 'linkedin',
    title: 'AI and the Future of Work: What I Learned from 100 CEO Conversations',
    author: 'Reid Hoffman',
    author_url: 'https://linkedin.com/in/reidhoffman',
    content: 'Over the past year, I spoke with 100 CEOs about how AI is transforming their companies...',
    media_urls: null,
    published_at: '2025-12-25T09:00:00Z',
    category: 'ai',
    tags: ['opinion', 'insight', 'analysis'],
    blurb: 'Reid Hoffman synthesizes insights from conversations with 100 CEOs about AI adoption, workforce transformation, and the skills that will matter most in the next decade.',
    summary: `Reid shares patterns from extensive conversations with business leaders navigating AI transformation.

The common thread is that successful AI adoption starts with culture, not technology. Companies that empower employees to experiment with AI tools see faster and more sustainable adoption than those with top-down mandates.

Skills that are becoming more valuable include prompt engineering, AI output evaluation, and the ability to break down complex problems for AI assistance. Pure technical skills are becoming commoditized.

The post concludes with predictions: the most successful professionals will be those who can effectively orchestrate AI tools while bringing uniquely human qualities like creativity, empathy, and strategic thinking.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: {
      og: {
        title: 'AI and the Future of Work: What I Learned from 100 CEO Conversations',
        description: 'Insights from conversations with 100 CEOs about AI adoption, workforce transformation, and the skills that will matter most.',
        image: 'https://media.licdn.com/dms/image/D4E03AQHp0p7p7p7p7p/profile-displayphoto-shrink_800_800/0/1234567890',
        siteName: 'LinkedIn',
        type: 'article',
        author: 'Reid Hoffman',
        publishedTime: '2025-12-25T09:00:00Z',
      },
      linkedin: {
        likes: 15600,
        comments: 892,
        reposts: 2340,
      },
    },
    created_at: '2025-12-25T11:30:00Z',
    updated_at: '2025-12-25T11:30:00Z',
  },
  {
    id: '6',
    user_id: 'user-1',
    url: 'https://paulgraham.com/persistence.html',
    source: 'web',
    title: 'The Art of Persistence in Startups',
    author: 'Paul Graham',
    author_url: 'https://paulgraham.com',
    content: 'One of the most important qualities in startup founders is persistence...',
    media_urls: null,
    published_at: '2025-12-20T14:00:00Z',
    category: 'startups',
    tags: ['guide', 'insight', 'reference'],
    blurb: 'Paul Graham explores the nuanced difference between persistence and stubbornness in startups, and how founders can tell when to push through versus when to pivot.',
    summary: `PG dissects one of the most misunderstood qualities in entrepreneurship: knowing when to persist.

The essay distinguishes between productive persistence and destructive stubbornness. The former involves iterating on the approach while keeping the goal fixed; the latter involves repeating the same failing approach.

Key indicators of when to persist: users who love the product even if few, clear paths to solving identified problems, and personal energy that renews rather than depletes when working on the idea.

The conclusion offers practical advice: set time-bounded experiments, gather data obsessively, and be honest about whether you are solving a real problem or just attached to a solution.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: {
      og: {
        title: 'The Art of Persistence',
        description: 'One of the most important qualities in startup founders is persistence. But there is a fine line between persistence and stubbornness.',
        siteName: 'Paul Graham',
        type: 'article',
        author: 'Paul Graham',
        publishedTime: '2025-12-20T14:00:00Z',
      },
      web: {
        readingTime: 8,
        wordCount: 2400,
      },
    },
    created_at: '2025-12-20T16:00:00Z',
    updated_at: '2025-12-20T16:00:00Z',
  },
  {
    id: '7',
    user_id: 'user-1',
    url: 'https://twitter.com/levelsio/status/987654321098765432',
    source: 'twitter',
    title: 'Ship Fast: My Framework for Launching Products in 2 Weeks',
    author: 'Pieter Levels',
    author_url: 'https://twitter.com/levelsio',
    content: 'Thread: How I launch profitable products in 2 weeks or less...',
    media_urls: null,
    published_at: '2025-12-28T06:00:00Z',
    category: 'product',
    tags: ['thread', 'showcase', 'tutorial'],
    blurb: 'Pieter Levels shares his systematic approach to launching products quickly, from idea validation to getting first paying customers in under two weeks.',
    summary: `Pieter outlines his battle-tested framework for rapid product launches.

Day 1-3 focuses on validation: find a problem you personally have, verify others share it through Twitter polls and DMs, and identify if people are already paying for inferior solutions.

Day 4-10 is pure building: use boring technology you know well, skip nice-to-haves, and aim for the minimum viable product that solves the core problem. Ship to production on day one.

Day 11-14 is launch mode: build in public to generate interest, leverage Twitter for distribution, and focus on getting 10 paying customers before adding any features. The thread emphasizes that most products fail from building too much, not too little.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: null,
    created_at: '2025-12-28T06:30:00Z',
    updated_at: '2025-12-28T06:30:00Z',
  },
  {
    id: '8',
    user_id: 'user-1',
    url: 'https://reddit.com/r/ExperiencedDevs/comments/senior-to-staff',
    source: 'reddit',
    title: 'Making the Jump from Senior to Staff Engineer: What Actually Changes',
    author: 'staff_engineer_mentor',
    author_url: 'https://reddit.com/u/staff_engineer_mentor',
    content: 'After 3 years at staff level, here is what I wish someone told me...',
    media_urls: null,
    published_at: '2025-12-23T20:00:00Z',
    category: 'career',
    tags: ['discussion', 'guide', 'analysis'],
    blurb: 'A staff engineer shares the often-unspoken differences between senior and staff roles, including the shift from individual contribution to organizational impact.',
    summary: `The discussion reveals the hidden curriculum of staff-level engineering.

The biggest shift is from "how do I solve this problem" to "how do I ensure the right problems get solved." Staff engineers spend more time on problem selection and framing than on coding.

Communication skills become paramount. Staff engineers must translate technical concepts for executives, advocate for their teams, and build consensus across organizational boundaries.

Technical skills still matter but differently: instead of going deep on implementation, staff engineers need broad knowledge to recognize patterns, anticipate issues, and mentor others. The thread concludes with advice on developing these skills while still in senior roles.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: null,
    created_at: '2025-12-23T22:00:00Z',
    updated_at: '2025-12-23T22:00:00Z',
  },
  {
    id: '9',
    user_id: 'user-1',
    url: 'https://www.youtube.com/watch?v=theo-trpc-v11',
    source: 'youtube',
    title: 'tRPC v11: Type-Safe APIs Just Got Even Better',
    author: 'Theo - t3.gg',
    author_url: 'https://youtube.com/@t3dotgg',
    content: null,
    media_urls: ['https://img.youtube.com/vi/theo-trpc-v11/maxresdefault.jpg'],
    published_at: '2025-12-22T16:00:00Z',
    category: 'backend',
    tags: ['video', 'news', 'tutorial'],
    blurb: 'Theo breaks down the major changes in tRPC v11, including the new procedure builders, improved error handling, and seamless integration with React Server Components.',
    summary: `Theo explores the headline features in the latest tRPC release.

The new procedure builder API simplifies creating typed endpoints with better middleware composition. The examples show how to build authenticated, rate-limited, and logged procedures with minimal boilerplate.

Error handling improvements include typed error codes and better client-side error discrimination. The new TRPCError class makes it easy to return consistent error responses.

React Server Components integration is demonstrated with examples of calling tRPC procedures directly from server components without waterfall requests. The video concludes with migration tips for existing tRPC v10 projects.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: null,
    created_at: '2025-12-22T18:00:00Z',
    updated_at: '2025-12-22T18:00:00Z',
  },
  {
    id: '10',
    user_id: 'user-1',
    url: 'https://linkedin.com/posts/juliazhu/product-sense',
    source: 'linkedin',
    title: 'Developing Product Sense: A Framework for Technical PMs',
    author: 'Julie Zhuo',
    author_url: 'https://linkedin.com/in/juliezhuo',
    content: 'Product sense is often described as magic, but it can be developed systematically...',
    media_urls: null,
    published_at: '2025-12-18T09:00:00Z',
    category: 'product',
    tags: ['guide', 'tutorial', 'reference'],
    blurb: 'Julie Zhuo breaks down the components of product sense and provides a systematic approach for technical product managers to develop this critical skill.',
    summary: `Julie demystifies product sense with a practical framework for skill development.

Product sense comprises three learnable components: user empathy (understanding why people behave as they do), pattern recognition (connecting user needs to solution shapes), and taste (knowing what quality looks like in context).

Each component can be developed through specific practices. User empathy grows through regular user interviews and support ticket review. Pattern recognition develops by studying successful products in adjacent spaces.

The post provides weekly exercises for each component, emphasizing that product sense is not innate talent but accumulated experience organized into useful mental models.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: null,
    created_at: '2025-12-18T11:00:00Z',
    updated_at: '2025-12-18T11:00:00Z',
  },
  {
    id: '11',
    user_id: 'user-1',
    url: 'https://stripe.com/blog/api-versioning-lessons',
    source: 'web',
    title: 'API Versioning at Scale: Lessons from a Decade at Stripe',
    author: 'Stripe Engineering',
    author_url: 'https://stripe.com/blog',
    content: null,
    media_urls: null,
    published_at: '2025-12-15T10:00:00Z',
    category: 'apis',
    tags: ['guide', 'analysis', 'reference'],
    blurb: 'The Stripe engineering team shares their approach to API versioning that has allowed them to evolve rapidly while maintaining backwards compatibility for millions of integrations.',
    summary: `Stripe reveals the principles behind their renowned API versioning system.

The core insight is that API versions should be dates, not semver. When a breaking change is introduced, it gets a new date version. Clients pin to their integration date and can upgrade at their own pace.

Implementation details cover how they maintain compatibility shims, test across version combinations, and document changes. The team describes their internal tooling for tracking which changes affect which versions.

The post concludes with advice for teams building APIs: start with versioning from day one, invest heavily in change detection testing, and treat API stability as a feature, not a constraint.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: null,
    created_at: '2025-12-15T12:00:00Z',
    updated_at: '2025-12-15T12:00:00Z',
  },
  {
    id: '12',
    user_id: 'user-1',
    url: 'https://twitter.com/swyx/status/ai-engineering-thread',
    source: 'twitter',
    title: 'AI Engineering is Not Prompt Engineering: The Skills That Actually Matter',
    author: 'swyx',
    author_url: 'https://twitter.com/swyx',
    content: 'Thread: Everyone is talking about prompt engineering but the real skill is AI engineering...',
    media_urls: null,
    published_at: '2025-12-27T14:00:00Z',
    category: 'ai',
    tags: ['thread', 'opinion', 'insight'],
    blurb: 'Swyx distinguishes AI engineering from prompt engineering, outlining the technical skills required to build production AI applications beyond crafting prompts.',
    summary: `Swyx clarifies the emerging discipline of AI engineering.

Prompt engineering is just one small part. AI engineering encompasses the full stack: evaluation frameworks to measure model quality, retrieval systems to ground responses in data, orchestration patterns to chain model calls, and infrastructure to deploy reliably.

Key skills include designing evaluation suites that catch regressions, building RAG pipelines that balance retrieval quality with latency, and implementing guardrails that prevent harmful outputs.

The thread concludes with a learning roadmap: start with the OpenAI cookbook, progress to LangChain and LlamaIndex, then build custom tooling as you hit their limits.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: null,
    created_at: '2025-12-27T15:00:00Z',
    updated_at: '2025-12-27T15:00:00Z',
  },
  {
    id: '13',
    user_id: 'user-1',
    url: 'https://reddit.com/r/design/comments/figma-to-code',
    source: 'reddit',
    title: 'How Our Team Cut Design-to-Code Time by 60%',
    author: 'design_systems_lead',
    author_url: 'https://reddit.com/u/design_systems_lead',
    content: 'We recently revamped our design-to-code workflow and the results have been remarkable...',
    media_urls: null,
    published_at: '2025-12-21T08:00:00Z',
    category: 'design',
    tags: ['showcase', 'tutorial', 'tool'],
    blurb: 'A design systems lead shares how their team streamlined the Figma-to-code workflow, with specific tools, processes, and metrics from a 6-month transformation.',
    summary: `The discussion details a comprehensive workflow transformation with measurable results.

The foundation was aligning Figma component structure with React component architecture. Every design component maps 1:1 to a code component, using identical naming and prop conventions.

Tooling investments included automated design token extraction, visual regression testing that compares Figma to implementations, and Storybook integration that designers can reference.

The process changes were equally important: designers now think in components from the start, regular sync meetings prevent divergence, and a shared component inventory reduces duplication. The 60% time reduction came from eliminating back-and-forth, not from automation alone.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: null,
    created_at: '2025-12-21T10:00:00Z',
    updated_at: '2025-12-21T10:00:00Z',
  },
  {
    id: '14',
    user_id: 'user-1',
    url: 'https://www.youtube.com/watch?v=primagen-vim',
    source: 'youtube',
    title: 'Why I Switched Back to Vim After 5 Years of VS Code',
    author: 'ThePrimeagen',
    author_url: 'https://youtube.com/@ThePrimeagen',
    content: null,
    media_urls: ['https://img.youtube.com/vi/primagen-vim/maxresdefault.jpg'],
    published_at: '2025-12-19T20:00:00Z',
    category: 'programming',
    tags: ['video', 'opinion', 'review'],
    blurb: 'ThePrimeagen explains his journey back to Vim, covering the productivity gains, learning curve, and configuration setup that made the switch worthwhile.',
    summary: `Prime shares his reasoning for returning to Vim after years of VS Code.

The primary motivation was speed. Not just editing speed, but the mental overhead reduction from never leaving the keyboard. He demonstrates workflows that are genuinely faster in Vim.

The video covers his Neovim configuration, including essential plugins like telescope, treesitter, and LSP. He emphasizes starting minimal and adding complexity only when needed.

The conclusion acknowledges VS Code's strengths for collaboration and extension ecosystem, suggesting Vim is best for developers who prioritize personal editing efficiency over team uniformity.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: null,
    created_at: '2025-12-19T22:00:00Z',
    updated_at: '2025-12-19T22:00:00Z',
  },
  {
    id: '15',
    user_id: 'user-1',
    url: 'https://linkedin.com/posts/growth-marketing-saas',
    source: 'linkedin',
    title: 'The Content Flywheel: How We Grew to 50K MRR with Zero Paid Ads',
    author: 'Amanda Natividad',
    author_url: 'https://linkedin.com/in/amandanat',
    content: 'We built a content engine that drives all our growth. Here is exactly how...',
    media_urls: null,
    published_at: '2025-12-16T10:00:00Z',
    category: 'marketing',
    tags: ['showcase', 'guide', 'tutorial'],
    blurb: 'A detailed breakdown of building a content-driven growth engine, with specific examples of content types, distribution channels, and conversion optimization.',
    summary: `Amanda reveals the content strategy that powered significant organic growth.

The flywheel starts with SEO-optimized blog content targeting high-intent keywords. Each post is designed to rank and convert, with clear CTAs and lead magnets integrated naturally.

Distribution amplifies reach: every blog post becomes a Twitter thread, LinkedIn post, newsletter issue, and YouTube video. The same core ideas reach audiences on their preferred platforms.

Conversion optimization includes A/B tested landing pages, email nurture sequences, and strategic free tool offerings that demonstrate value before asking for payment. The post includes specific metrics at each funnel stage.`,
    processing_status: 'completed',
    processing_error: null,
    raw_metadata: null,
    created_at: '2025-12-16T12:00:00Z',
    updated_at: '2025-12-16T12:00:00Z',
  },
  {
    id: '16',
    user_id: 'user-1',
    url: 'https://twitter.com/natfriedman/status/new-project-thread',
    source: 'twitter',
    title: 'Announcing Our New AI Research Lab',
    author: 'Nat Friedman',
    author_url: 'https://twitter.com/natfriedman',
    content: 'Excited to share what we have been working on...',
    media_urls: null,
    published_at: '2025-12-28T09:00:00Z',
    category: 'ai',
    tags: ['announcement', 'news'],
    blurb: 'Nat Friedman announces a new AI research lab focused on open-source model development.',
    summary: '',
    processing_status: 'pending',
    processing_error: null,
    raw_metadata: null,
    created_at: '2025-12-28T09:15:00Z',
    updated_at: '2025-12-28T09:15:00Z',
  },
  {
    id: '17',
    user_id: 'user-1',
    url: 'https://blog.samaltman.com/productivity-systems',
    source: 'web',
    title: 'How I Manage My Time and Energy',
    author: 'Sam Altman',
    author_url: 'https://blog.samaltman.com',
    content: null,
    media_urls: null,
    published_at: '2025-12-27T08:00:00Z',
    category: 'productivity',
    tags: ['guide', 'reference'],
    blurb: 'Sam Altman shares his personal productivity system, including how he prioritizes, manages energy, and makes time for deep work.',
    summary: '',
    processing_status: 'processing',
    processing_error: null,
    raw_metadata: null,
    created_at: '2025-12-27T08:30:00Z',
    updated_at: '2025-12-28T10:00:00Z',
  },
  {
    id: '18',
    user_id: 'user-1',
    url: 'https://reddit.com/r/programming/comments/broken-link-123',
    source: 'reddit',
    title: 'Understanding Database Sharding at Scale',
    author: 'db_architect',
    author_url: 'https://reddit.com/u/db_architect',
    content: null,
    media_urls: null,
    published_at: null,
    category: 'databases',
    tags: ['analysis'],
    blurb: 'A comprehensive discussion on database sharding strategies.',
    summary: '',
    processing_status: 'failed',
    processing_error: 'Failed to fetch content: HTTP 404 - Page not found',
    raw_metadata: null,
    created_at: '2025-12-26T14:00:00Z',
    updated_at: '2025-12-26T14:05:00Z',
  },
]

/**
 * Get count of bookmarks grouped by source
 */
export function getSourceCounts(bookmarks: Bookmark[]): Record<ContentSource, number> {
  const counts: Record<ContentSource, number> = {
    twitter: 0,
    reddit: 0,
    linkedin: 0,
    youtube: 0,
    web: 0,
  }

  for (const bookmark of bookmarks) {
    counts[bookmark.source]++
  }

  return counts
}

/**
 * Get count of bookmarks grouped by category
 */
export function getCategoryCounts(bookmarks: Bookmark[]): Record<Category, number> {
  const counts: Record<Category, number> = {
    // Tech
    ai: 0,
    machinelearning: 0,
    blockchain: 0,
    crypto: 0,
    defi: 0,
    web3: 0,
    devops: 0,
    cloud: 0,
    security: 0,
    mobile: 0,
    frontend: 0,
    backend: 0,
    databases: 0,
    apis: 0,
    programming: 0,
    // Business
    startups: 0,
    fundraising: 0,
    investing: 0,
    finance: 0,
    marketing: 0,
    sales: 0,
    growth: 0,
    product: 0,
    analytics: 0,
    saas: 0,
    enterprise: 0,
    // Creative & Career
    design: 0,
    ux: 0,
    career: 0,
    leadership: 0,
    productivity: 0,
    learning: 0,
    // Industry
    gaming: 0,
    hardware: 0,
    biotech: 0,
    ecommerce: 0,
    // General
    news: 0,
    other: 0,
  }

  for (const bookmark of bookmarks) {
    counts[bookmark.category]++
  }

  return counts
}

export function getBookmarkById(id: string): Bookmark | undefined {
  return mockBookmarks.find((bookmark) => bookmark.id === id)
}

export function getBookmarksByCategory(category: Category): Bookmark[] {
  return mockBookmarks.filter((bookmark) => bookmark.category === category)
}

export function getBookmarksBySource(source: ContentSource): Bookmark[] {
  return mockBookmarks.filter((bookmark) => bookmark.source === source)
}

export function getBookmarksByTag(tag: string): Bookmark[] {
  return mockBookmarks.filter((bookmark) => bookmark.tags.includes(tag as Bookmark['tags'][number]))
}

export function searchBookmarks(query: string): Bookmark[] {
  const lowerQuery = query.toLowerCase()
  return mockBookmarks.filter((bookmark) =>
    bookmark.title.toLowerCase().includes(lowerQuery) ||
    bookmark.blurb.toLowerCase().includes(lowerQuery) ||
    bookmark.author?.toLowerCase().includes(lowerQuery)
  )
}

export function getBookmarksByStatus(status: Bookmark['processing_status']): Bookmark[] {
  return mockBookmarks.filter((bookmark) => bookmark.processing_status === status)
}
