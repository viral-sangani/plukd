import type { Category, Tag } from '@/types'
import type { FewShotExample } from './twitter'

/**
 * Few-shot examples for blog article and web content.
 * These examples help guide AI categorization and summarization for long-form articles.
 */
export const articleExamples: FewShotExample[] = [
  {
    input: {
      title: 'The Complete Guide to Implementing RAG in Production',
      content: `Retrieval-Augmented Generation has become the standard architecture for building LLM applications that need accurate, up-to-date information. But there's a massive gap between demo RAG systems and production-ready implementations. This guide covers everything we learned deploying RAG for Fortune 500 companies.

Understanding the RAG Pipeline

At its core, RAG combines retrieval and generation. Documents are chunked, embedded, and stored in a vector database. At query time, relevant chunks are retrieved and passed to the LLM as context. Simple in theory, complex in practice.

Chunking Strategies

Your chunking strategy will make or break your RAG system. We've tested dozens of approaches:

Fixed-size chunks (500-1000 tokens) work for homogeneous content but lose context at boundaries. Semantic chunking using sentence boundaries preserves meaning but creates uneven chunk sizes. Document-structure-aware chunking respects headers, paragraphs, and sections but requires parsing logic.

Our recommendation: start with recursive character splitting at 800 tokens with 200 token overlap. Iterate based on retrieval quality metrics.

Embedding Model Selection

OpenAI's text-embedding-3-large is the safe default, but consider alternatives. Cohere's embed-v3 excels at multilingual content. For on-premise requirements, BGE and E5 models offer competitive quality with full data control.

Retrieval Optimization

Vector similarity alone isn't enough. Implement hybrid search combining vector similarity with BM25 keyword matching. Use re-ranking models like Cohere Rerank or cross-encoders to improve precision. Consider query expansion to capture semantic variations.

The retrieval step is your biggest accuracy lever. Invest heavily here before touching the generation side.`,
      source: 'web',
      author: 'DataStack Engineering Team',
    },
    output: {
      category: 'ai',
      tags: ['guide', 'tutorial', 'reference'],
      blurb:
        'A comprehensive production guide to RAG systems covering chunking strategies, embedding model selection, and retrieval optimization techniques learned from Fortune 500 deployments, with specific recommendations for each component.',
      summary: `This technical guide bridges the gap between proof-of-concept RAG implementations and production-grade systems, drawing on real-world experience deploying retrieval-augmented generation for enterprise clients.

The article establishes RAG fundamentals before diving into implementation details. The core pipeline involves chunking documents, generating embeddings, storing in vector databases, and retrieving relevant context at query time. While conceptually straightforward, production requirements introduce significant complexity.

Chunking strategy emerges as the most critical decision. The guide evaluates three approaches: fixed-size chunks (500-1000 tokens) that work for uniform content but lose context at boundaries; semantic chunking using sentence boundaries that preserves meaning but creates variable sizes; and document-structure-aware chunking that respects headers and sections but requires custom parsing. The recommended starting point is recursive character splitting at 800 tokens with 200 token overlap, then iterating based on measured retrieval quality.

For embedding models, the guide provides context-dependent recommendations. OpenAI's text-embedding-3-large serves as the reliable default. Cohere's embed-v3 is preferred for multilingual applications. For organizations with on-premise data requirements, open-source options like BGE and E5 offer competitive quality with complete data sovereignty.

The retrieval optimization section argues this is the highest-leverage area for accuracy improvements. Recommendations include implementing hybrid search that combines vector similarity with BM25 keyword matching, applying re-ranking models like Cohere Rerank or cross-encoders to improve precision, and using query expansion techniques to capture semantic variations. The key insight is that retrieval quality improvements should be prioritized over generation-side optimizations.`,
    },
  },
  {
    input: {
      title: 'What I Learned Raising a $15M Series A in 2024',
      content: `Last month we closed our Series A: $15M led by Sequoia with participation from existing investors. The process took 5 months and 47 investor meetings. Here's an honest account of what the fundraising landscape looks like right now.

The Market Has Changed

2024 is not 2021. VCs are deployment-constrained but extremely selective. They're writing fewer checks at higher conviction. "Spray and pray" is dead on both sides of the table.

What this means practically: you need either exceptional metrics or exceptional founders (ideally both). We had $2M ARR growing 20% MoM with 130% NDR. That opened doors. The market is not friendly to pre-revenue companies unless you have a unique founder-market fit story.

The Process

We ran a structured process: built a target list of 60 funds, tiered by preference. Spent 3 weeks on warm intros before any meetings. The data room was ready before the first call.

Timeline:
- Weeks 1-3: Warm intro outreach
- Weeks 4-8: First meetings (47 total)
- Weeks 9-12: Partner meetings and deep dives (12 funds)
- Weeks 13-16: Term sheets and negotiation (3 offers)
- Weeks 17-20: Due diligence and close

The partner meeting conversion rate was about 25% from first meetings, consistent with what I've heard from other founders.

What VCs Actually Care About

Forget the pitch deck frameworks. Every serious conversation focused on: market size and timing, why this team, unit economics trajectory, and competitive moats.

The "why now" question was surprisingly important. We had a clear thesis on why regulatory changes made our market accessible in ways it wasn't before.`,
      source: 'web',
      author: 'Jennifer Walsh',
    },
    output: {
      category: 'fundraising',
      tags: ['showcase', 'guide', 'insight'],
      blurb:
        'A founder documents their 5-month journey to closing a $15M Series A led by Sequoia, providing concrete timelines, conversion metrics, and insights into what VCs prioritize in 2024: exceptional metrics ($2M ARR, 20% MoM growth, 130% NDR) over vision alone.',
      summary: `This first-hand account of a successful Series A fundraise provides valuable tactical guidance for founders navigating the 2024 venture capital landscape. The author closed $15M from Sequoia after a methodical 5-month process involving 47 investor meetings.

The market analysis sets important context. The author emphasizes that 2024 venture investing bears little resemblance to 2021. VCs remain well-capitalized but are highly selective, writing fewer checks with higher conviction requirements. The implication for founders is clear: strong metrics or exceptional founder-market fit are now table stakes, not differentiators. The author's company entered the process with $2M ARR, 20% month-over-month growth, and 130% net dollar retention, metrics that opened doors but didn't guarantee success.

The process section provides a replicable framework. The team built a tiered target list of 60 funds ranked by strategic preference. Three weeks were dedicated to securing warm introductions before scheduling any meetings. A complete data room was prepared in advance. The timeline spanned 20 weeks total: 3 weeks of outreach, 5 weeks of first meetings, 4 weeks of partner meetings, 4 weeks of term sheet negotiation, and 4 weeks of due diligence to close. The 25% conversion rate from first meeting to partner meeting aligns with industry benchmarks.

The author identifies four topics that dominated serious investor conversations: market size and timing, team uniqueness, unit economics trajectory, and competitive moats. The "why now" framing proved especially important, with the company's thesis linking regulatory changes to new market accessibility serving as a compelling timing catalyst.`,
    },
  },
]
