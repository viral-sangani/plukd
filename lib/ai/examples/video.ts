import type { Category, Tag } from '@/types'
import type { FewShotExample } from './twitter'

/**
 * Few-shot examples for YouTube video content.
 * These examples help guide AI categorization and summarization for video transcripts.
 */
export const videoExamples: FewShotExample[] = [
  {
    input: {
      title:
        'How Figma Scaled to 1000 Engineers Without Breaking Their Culture',
      content: `[Transcript excerpt]

Today I want to talk about something that's really hard in tech: scaling engineering teams without losing what made you special in the first place.

When I joined Figma in 2019, we were about 50 engineers. Everyone knew everyone. We shipped fast. Decisions happened in Slack threads. It was magical.

Fast forward to today: we're over a thousand engineers. And honestly? We've managed to keep most of that magic. Not all of it, but most. Here's how.

The first thing we did was ruthlessly protect maker time. As we grew, meetings exploded. Everyone wanted to "align" and "sync." We instituted no-meeting Wednesdays company-wide. Then we added no-meeting mornings. Engineers get at least 20 hours of uninterrupted coding time per week. That's non-negotiable.

Second, we pushed decision-making down. The worst thing you can do when scaling is create bottlenecks at the top. We created clear ownership boundaries. If you own a surface area, you make the calls. You don't need three VPs to approve a button color change.

Third, we invested heavily in documentation. At 50 people, tribal knowledge works. At 500, it's a disaster. We built internal tools for RFCs, decision logs, architecture docs. New engineers can understand why decisions were made, not just what was decided.

Fourth, we kept the feedback loops tight. We still do weekly demos. Every team shows what they shipped. It creates accountability and keeps everyone connected to the product even as teams specialize.`,
      source: 'youtube',
      author: 'Figma Engineering',
    },
    output: {
      category: 'devops',
      tags: ['video', 'showcase', 'analysis'],
      blurb:
        'Figma engineering leadership explains how they scaled from 50 to 1000+ engineers while preserving startup culture through protected maker time, decentralized decision-making, comprehensive documentation, and weekly demo rituals.',
      summary: `This engineering leadership talk addresses one of the most challenging problems in tech: scaling teams while preserving the culture and velocity that made the company successful. The speaker draws on Figma's journey from 50 to over 1000 engineers.

The first pillar of their approach is ruthlessly protecting maker time. As the company grew, meeting proliferation threatened to consume engineering hours. The response was structural: company-wide no-meeting Wednesdays, followed by no-meeting mornings on other days. The result is a guaranteed minimum of 20 hours weekly for focused coding time, enforced as a non-negotiable policy rather than a suggestion.

Decentralized decision-making forms the second pillar. The speaker identifies executive bottlenecks as the most common scaling failure mode. Figma's solution establishes clear ownership boundaries where surface area owners have full authority to make calls within their domain. This eliminates the need for multiple layers of VP approval on routine decisions.

The third pillar addresses knowledge management. Tribal knowledge that works at 50 people becomes a liability at 500. Figma invested in internal tooling for RFCs (Request for Comments), decision logs, and architecture documentation. The emphasis is on capturing not just what was decided, but why, enabling new engineers to understand historical context.

The fourth pillar maintains connection through ritual. Weekly demo sessions where every team showcases shipped work create accountability and cross-team visibility. As teams specialize and naturally silo, these regular touchpoints keep everyone connected to the overall product direction. The speaker argues this combination of protected time, distributed authority, accessible knowledge, and shared rituals allows large organizations to retain startup-like characteristics.`,
    },
  },
  {
    input: {
      title: 'The Psychology of Pricing: Why $99 Beats $100 (And When It Does Not)',
      content: `[Transcript excerpt]

Let's talk about pricing psychology. Specifically, why does $99 feel so different from $100? And more importantly, when should you actually use these tactics?

I've spent 15 years studying consumer behavior and pricing, and I'm going to tell you: most of what you've read about pricing psychology is oversimplified.

The left-digit effect is real. When we process $99 versus $100, we anchor on that first digit. Our brains read left to right. The 9 gets encoded as "ninety-something" before we process the full number. Studies show this can increase purchase intent by 8-12%.

But here's what the blog posts don't tell you. The effect varies dramatically by context.

For low-involvement purchases, charm pricing works great. Grocery items, impulse buys, commodity products. Consumers aren't doing math. They're pattern matching.

For high-involvement purchases, charm pricing can backfire. If you're selling $10,000 consulting packages, $9,999 looks desperate. It signals discounting rather than premium positioning.

The research shows an interesting pattern: as price increases, round numbers actually outperform charm prices. Above about $500, consumers prefer $500 to $499. The round number signals confidence and quality.

There's also a cultural dimension. Charm pricing effectiveness varies by country. It works better in the US than in Germany. Asian markets have their own lucky number dynamics.

My recommendation: test everything. A/B test your prices. The psychology research gives you hypotheses, not answers. Your specific audience might behave completely differently from the population averages.`,
      source: 'youtube',
      author: 'Dr. Michelle Torres',
    },
    output: {
      category: 'marketing',
      tags: ['video', 'analysis', 'reference'],
      blurb:
        'A behavioral economist breaks down when charm pricing ($99 vs $100) actually works, revealing that the effect reverses for high-ticket items above $500 where round numbers signal confidence rather than desperation.',
      summary: `This presentation from a behavioral economist with 15 years of pricing research experience provides a nuanced analysis of charm pricing psychology, moving beyond the oversimplified advice common in marketing content.

The foundational mechanism is the left-digit effect. When processing prices like $99 versus $100, consumers anchor on the first digit, encoding "ninety-something" before fully processing the number. Research quantifies this effect at an 8-12% increase in purchase intent. However, the speaker emphasizes that this average masks significant contextual variation.

Purchase involvement level determines effectiveness. For low-involvement purchases such as groceries, impulse items, and commodity products, charm pricing works reliably because consumers pattern-match rather than calculate. For high-involvement purchases, particularly premium services and consulting, charm pricing can signal desperation and undermine positioning. A $9,999 consulting package reads as discounted rather than premium.

The speaker highlights a counterintuitive research finding: as absolute price increases, round numbers begin outperforming charm prices. Above approximately $500, consumers prefer $500 to $499. The round number communicates confidence and quality rather than bargain-hunting.

Cultural factors add another layer of complexity. Charm pricing effectiveness varies by country, performing better in the US than Germany. Asian markets have entirely different dynamics driven by culturally significant lucky numbers.

The practical recommendation is rigorous testing. Pricing psychology research provides hypotheses, not answers. Specific audiences may diverge significantly from population averages. A/B testing prices with actual customers yields better decisions than applying general principles blindly. The speaker advocates treating research as a starting point for experimentation rather than a playbook for implementation.`,
    },
  },
]
