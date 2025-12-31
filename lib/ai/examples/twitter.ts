import type { Category, Tag } from '@/types'

export interface FewShotExample {
  input: {
    title: string
    content: string
    source: string
    author?: string
  }
  output: {
    category: Category
    tags: Tag[]
    blurb: string
    summary: string
  }
}

/**
 * Few-shot examples for Twitter/X thread content.
 * These examples help guide AI categorization and summarization for social threads.
 */
export const twitterExamples: FewShotExample[] = [
  {
    input: {
      title: 'Thread on building AI agents that actually work in production',
      content: `After deploying 50+ AI agents for enterprise clients, here's what I've learned about making them reliable. Thread (1/12)

Most agents fail because developers treat them like chatbots. Big mistake. Production agents need state machines, not just prompt chains. Here's the architecture we use...

The key insight: agents need explicit memory management. We use a three-tier system: working memory (current task), episodic memory (recent interactions), and semantic memory (learned knowledge).

Error handling is where 90% of agent implementations break. You need graceful degradation paths. When the LLM hallucinates, your agent should recognize it and fall back to deterministic logic.

Tool use is another pain point. We cap tools at 5-7 per agent. More than that and the model gets confused. Each tool needs crystal clear descriptions and error messages.

Evaluation is hard but essential. We built automated test suites that run 100+ scenarios nightly. If accuracy drops below 95%, deployment is blocked.

The ROI has been incredible. One client reduced their support ticket resolution time from 45 minutes to 8 minutes. Another automated 70% of their data entry workflows.`,
      source: 'twitter',
      author: 'Sarah Chen',
    },
    output: {
      category: 'ai',
      tags: ['thread', 'analysis', 'tutorial'],
      blurb:
        'A practitioner shares battle-tested lessons from deploying 50+ production AI agents, covering architecture patterns like three-tier memory systems, error handling strategies, and tool design principles that separate working agents from fragile demos.',
      summary: `This comprehensive thread distills practical wisdom from extensive production AI agent deployments. The author emphasizes a fundamental mindset shift: production agents require state machine architectures rather than simple prompt chains that work in demos but fail at scale.

The technical architecture centers on a three-tier memory system. Working memory handles the current task context, episodic memory retains recent interaction history, and semantic memory stores learned knowledge that persists across sessions. This separation allows agents to maintain coherent long-running conversations while building institutional knowledge.

Error handling emerges as the critical differentiator between demo and production systems. The recommended approach implements graceful degradation paths that detect LLM hallucinations and fall back to deterministic logic rather than propagating errors. This defensive programming approach is essential for enterprise reliability requirements.

Tool design follows the principle of constraint. Limiting agents to 5-7 tools prevents model confusion, with each tool requiring precise descriptions and comprehensive error messages. The author argues that more tools create exponentially more failure modes without proportional capability gains.

The business impact validates the engineering investment. Case studies include reducing support ticket resolution from 45 to 8 minutes and automating 70% of data entry workflows. The emphasis on automated evaluation with 95%+ accuracy gates ensures these gains remain sustainable over time.`,
    },
  },
  {
    input: {
      title: 'Why we switched from Kubernetes to simple VMs (and saved $400k/year)',
      content: `Hot take: K8s is overkill for 95% of startups. We ran it for 3 years and just migrated to plain VMs. Here's what happened...

Our K8s setup: 15 nodes, managed EKS, full GitOps with ArgoCD. Looked great on paper. Reality: 2 full-time engineers just managing infrastructure. $50k/month in AWS costs.

The breaking point was a 4-hour outage caused by a helm chart upgrade. We had to fly in a consultant to fix it. That's when we asked: do we actually need this?

Spoiler: we didn't. Our traffic is predictable. We don't need auto-scaling. We deploy twice a week, not twice an hour.

New setup: 8 large VMs behind a load balancer. Ansible for config management. GitHub Actions for CI/CD. That's it.

Migration took 6 weeks. Yes, we lost some fancy features. Blue-green deployments are manual now. But our ops burden dropped 80%. Engineers can focus on product again.

Total savings: ~$400k/year when you factor in reduced AWS costs, no K8s tooling subscriptions, and not needing dedicated platform engineers.

K8s is amazing technology. But complexity has a cost. Know your actual requirements before adopting it.`,
      source: 'twitter',
      author: 'Marcus Rodriguez',
    },
    output: {
      category: 'cloud',
      tags: ['thread', 'showcase', 'opinion'],
      blurb:
        'A startup CTO documents their journey from a complex Kubernetes setup to simple VMs, revealing how over-engineering consumed two full-time engineers and led to a 4-hour outage, while the simpler architecture cut costs by $400k annually.',
      summary: `This thread presents a contrarian but data-backed argument against Kubernetes adoption for typical startup workloads. The author's company ran a production-grade K8s setup with 15 nodes on managed EKS, GitOps workflows via ArgoCD, and all the recommended practices for three years before concluding it was unnecessary complexity.

The quantified costs were substantial: two full-time engineers dedicated to infrastructure management and $50,000 monthly in AWS spending. The catalyst for change was a 4-hour production outage triggered by a routine Helm chart upgrade that required an external consultant to resolve. This incident prompted a fundamental reassessment of actual requirements versus adopted complexity.

The honest self-assessment revealed that the company's traffic patterns were predictable, auto-scaling provided minimal value, and deployment frequency was twice weekly rather than continuous. None of the core Kubernetes value propositions aligned with their actual operational needs.

The replacement architecture is deliberately simple: 8 large VMs behind a load balancer, Ansible for configuration management, and GitHub Actions for CI/CD. The 6-week migration sacrificed some conveniences like automated blue-green deployments but reduced operational burden by 80%.

The financial impact totals approximately $400,000 in annual savings across reduced AWS costs, eliminated tooling subscriptions, and reassigned platform engineering headcount. The author's balanced conclusion acknowledges Kubernetes as excellent technology while arguing that complexity costs must be weighed against genuine requirements.`,
    },
  },
]
