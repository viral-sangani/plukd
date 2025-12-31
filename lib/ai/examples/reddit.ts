import type { Category, Tag } from '@/types'
import type { FewShotExample } from './twitter'

/**
 * Few-shot examples for Reddit post content.
 * These examples help guide AI categorization and summarization for community discussions.
 */
export const redditExamples: FewShotExample[] = [
  {
    input: {
      title:
        'I built a SaaS that hit $10k MRR in 6 months. Here is everything I learned.',
      content: `Hey r/SaaS, wanted to share my journey since this community helped me so much when starting out.

Quick background: I'm a solo dev who quit my FAANG job in January. Built a tool that helps e-commerce stores automate their inventory forecasting using ML. Launched in February, hit $10k MRR last week.

What worked:
1. Talked to 50+ potential customers BEFORE writing code. Sounds obvious but I skipped this step on my last 2 failed projects.
2. Charged from day 1. Started at $49/mo, now at $149/mo. Early customers understood the value and stuck around.
3. Built in public on Twitter. Got my first 20 customers entirely from followers who watched me build.
4. Focused on one ICP (Shopify stores doing $1-10M revenue). Ignored everyone else.
5. Support is my moat. I personally onboard every customer. Takes 2 hours each but churn is under 3%.

What didn't work:
- ProductHunt launch was meh. Got 200 upvotes, 3 paying customers.
- Cold email was a waste of time. 2000 emails, 2 demos, 0 conversions.
- Trying to serve both Shopify and WooCommerce. Split focus killed velocity.

Current challenges: Hiring my first employee (terrifying), dealing with enterprise requests, and honestly just the mental load of doing everything solo.

Happy to answer any questions!`,
      source: 'reddit',
      author: 'inventory_dev',
    },
    output: {
      category: 'startups',
      tags: ['showcase', 'discussion', 'insight'],
      blurb:
        'A solo founder shares a transparent breakdown of reaching $10k MRR in 6 months with an ML-powered inventory tool, including specific tactics that worked (customer discovery, charging early, building in public) and honest failures (ProductHunt, cold email).',
      summary: `This Reddit post offers a candid retrospective from a solo founder who achieved $10k MRR within six months of launching an ML-based inventory forecasting tool for e-commerce stores. The transparency about both successes and failures makes this particularly valuable for early-stage founders.

The author attributes success to five key practices. First, conducting 50+ customer discovery conversations before writing code, a lesson learned from two previous failed projects. Second, implementing pricing from launch day, starting at $49/month and confidently raising to $149/month as value became clearer. Third, building in public on Twitter, which generated the first 20 paying customers organically. Fourth, maintaining strict ICP focus on Shopify stores in the $1-10M revenue range while ignoring adjacent opportunities. Fifth, treating support as a competitive moat through personal 2-hour onboarding sessions that keep churn under 3%.

The failures are equally instructive. A ProductHunt launch delivered vanity metrics (200 upvotes) but minimal business impact (3 customers). A 2,000-email cold outreach campaign yielded zero conversions. Attempting to serve both Shopify and WooCommerce fragmented development focus and slowed progress.

Current challenges center on scaling beyond solo operation: the psychological difficulty of making a first hire, handling inbound enterprise interest that falls outside the current product scope, and managing the cognitive load of wearing every hat simultaneously.

The community discussion in comments provides additional perspectives on pricing strategy, hiring timing, and whether to pursue enterprise deals or stay focused on SMB customers.`,
    },
  },
  {
    input: {
      title:
        'Unpopular opinion: Most "clean code" advice makes codebases worse',
      content: `I've been programming for 15 years and tech leading for 5. Hot take that will probably get me downvoted: the obsession with clean code principles often creates more problems than it solves.

Don't get me wrong - code should be readable. But somewhere along the way, "clean code" became a religion instead of a tool.

Examples of advice that often backfires:

"Extract everything into small functions" - I've seen codebases where understanding a simple operation requires jumping through 15 files. The mental overhead of tracking all those abstractions exceeds the complexity of the original code.

"DRY at all costs" - Premature abstraction is worse than duplication. I'd rather see the same 10 lines in 3 places than a fragile abstraction that breaks when requirements diverge.

"Always use design patterns" - Patterns solve specific problems. Using a Factory pattern for a class that will only ever have one implementation is cargo culting.

"Comments are a code smell" - Some domain logic genuinely needs explanation. Financial calculations, regulatory requirements, and business rules often can't be made self-documenting.

What actually matters IMO:
- Can a new team member understand this in reasonable time?
- Can we change this code without breaking unrelated things?
- Does it do what it's supposed to do?

The best code I've seen prioritizes local reasoning over global patterns. You can understand each piece in isolation without holding the entire system in your head.

Interested in hearing other perspectives. Am I totally off base here?`,
      source: 'reddit',
      author: 'grumpy_tech_lead',
    },
    output: {
      category: 'programming',
      tags: ['opinion', 'discussion', 'analysis'],
      blurb:
        'A veteran tech lead challenges dogmatic "clean code" principles, arguing that excessive function extraction, premature DRY abstraction, and cargo-cult design patterns often harm codebases more than the problems they claim to solve.',
      summary: `This thought-provoking post challenges widely accepted software engineering orthodoxy from the perspective of a 15-year practitioner and 5-year tech lead. The core argument is that clean code principles, while valuable as guidelines, have calcified into counterproductive dogma.

The author identifies several specific principles that frequently backfire in practice. Aggressive function extraction, intended to improve readability, often creates codebases requiring navigation through 15+ files to understand simple operations. The mental overhead of tracking abstractions can exceed the complexity of straightforward inline code.

The DRY (Don't Repeat Yourself) principle receives particular criticism. The author argues that premature abstraction creates fragile shared code that breaks when requirements inevitably diverge. Three copies of 10 lines each may be preferable to one abstraction serving three slightly different use cases.

Design pattern usage is characterized as frequently cargo-culted. Implementing a Factory pattern for a class with only one concrete implementation adds indirection without benefit. Patterns should solve actual problems, not demonstrate theoretical knowledge.

The post also pushes back against the absolutist stance that comments indicate bad code. Complex domain logic in financial calculations, regulatory compliance, and business rules often requires explanatory context that cannot be encoded in method names alone.

The alternative framework proposed focuses on practical concerns: onboarding speed for new team members, change isolation to prevent cascading breakage, and correctness. The author advocates for "local reasoning" where each code section can be understood independently without requiring mental models of the entire system. The ensuing comment discussion features productive debate between defenders of traditional clean code and those who share the author's pragmatic skepticism.`,
    },
  },
]
