'use client'

import { useState, useMemo } from 'react'
import { ExternalLink, Book, Wrench, Film, Tv, Headphones, GraduationCap, Package, ChevronDown, ChevronRight } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { ExtractedResource, ResourceLayoutHint } from '@plukd/shared/types'

interface ResourceListProps {
  resources: ExtractedResource[]
  layoutHint?: ResourceLayoutHint | null
}

/**
 * Get icon for resource category
 */
function getCategoryIcon(category?: string) {
  switch (category?.toLowerCase()) {
    case 'book':
      return <Book className="size-4" />
    case 'tool':
    case 'app':
      return <Wrench className="size-4" />
    case 'movie':
      return <Film className="size-4" />
    case 'show':
    case 'tv':
      return <Tv className="size-4" />
    case 'podcast':
      return <Headphones className="size-4" />
    case 'course':
      return <GraduationCap className="size-4" />
    default:
      return <Package className="size-4" />
  }
}

/**
 * Get display label for resource category
 */
function getCategoryLabel(category?: string): string {
  if (!category) return 'Resource'
  return category.charAt(0).toUpperCase() + category.slice(1)
}

/**
 * Helper to safely get hostname from URL
 */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// ============================================
// LAYOUT COMPONENTS
// ============================================

/**
 * Simple List Layout - Default fallback
 */
function SimpleListLayout({ resources }: { resources: ExtractedResource[] }) {
  return (
    <section className="mb-8">
      <h2 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-3">
        Extracted Resources ({resources.length})
      </h2>
      <div className="bg-background border border-border rounded-none divide-y divide-border">
        {resources.map((resource, index) => (
          <div key={index} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5 text-foreground-muted">
                {getCategoryIcon(resource.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-mono font-medium text-foreground">
                    {resource.name}
                  </span>
                  {resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:text-accent/80 transition-colors"
                      aria-label="Open link"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                {resource.description && (
                  <p className="text-xs font-mono text-foreground-muted leading-relaxed">
                    {resource.description}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 text-xs font-mono text-foreground-muted/50">
                {index + 1}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Numbered Steps Layout - Sequential content with numbered circles
 */
function NumberedStepsLayout({ resources }: { resources: ExtractedResource[] }) {
  return (
    <section className="mb-8">
      <h2 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-3">
        Steps ({resources.length})
      </h2>
      <div className="bg-background border border-border rounded-none p-4 space-y-4">
        {resources.map((resource, index) => (
          <div key={index} className="flex items-start gap-4">
            <div className="flex-shrink-0 size-7 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
              <span className="text-xs font-mono font-medium text-accent">
                {index + 1}
              </span>
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono font-medium text-foreground">
                  {resource.name}
                </span>
                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent/80 transition-colors"
                    aria-label="Open link"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              {resource.description && (
                <p className="text-xs font-mono text-foreground-muted leading-relaxed">
                  {resource.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Grid Layout - Compact cards in a 2-3 column grid
 */
function GridLayout({ resources }: { resources: ExtractedResource[] }) {
  return (
    <section className="mb-8">
      <h2 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-3">
        Resources ({resources.length})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {resources.map((resource, index) => (
          <div
            key={index}
            className="bg-background border border-border rounded-none p-3 hover:border-border-emphasis transition-colors"
          >
            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 mt-0.5 text-foreground-muted">
                {getCategoryIcon(resource.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm font-mono font-medium text-foreground truncate">
                    {resource.name}
                  </span>
                  {resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-accent hover:text-accent/80 transition-colors"
                      aria-label="Open link"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                {resource.description && (
                  <p className="text-[11px] font-mono text-foreground-muted leading-relaxed">
                    {resource.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Accordion Layout - Group resources by category with collapsible sections
 */
function AccordionLayout({ resources }: { resources: ExtractedResource[] }) {
  // Group resources by category
  const grouped = useMemo(() => {
    const groups: Record<string, ExtractedResource[]> = {}
    for (const resource of resources) {
      const category = resource.category || 'Other'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(resource)
    }
    return groups
  }, [resources])

  const categories = Object.keys(grouped)

  // If all resources have same/null category, fall back to simple list
  if (categories.length <= 1) {
    return <SimpleListLayout resources={resources} />
  }

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set([categories[0]])
  )

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  return (
    <section className="mb-8">
      <h2 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-3">
        Extracted Resources ({resources.length})
      </h2>
      <div className="bg-background border border-border rounded-none divide-y divide-border">
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category)
          const categoryResources = grouped[category]

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-4 hover:bg-background-emphasis/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="text-foreground-muted">
                    {getCategoryIcon(category)}
                  </div>
                  <span className="text-sm font-mono font-medium text-foreground">
                    {getCategoryLabel(category)}
                  </span>
                  <span className="text-xs font-mono text-foreground-muted">
                    ({categoryResources.length})
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="size-4 text-foreground-muted" />
                ) : (
                  <ChevronRight className="size-4 text-foreground-muted" />
                )}
              </button>
              {isExpanded && (
                <div className="border-t border-border divide-y divide-border/50">
                  {categoryResources.map((resource, index) => (
                    <div key={index} className="p-4 pl-10 bg-background-muted/30">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-mono font-medium text-foreground">
                              {resource.name}
                            </span>
                            {resource.url && (
                              <a
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent hover:text-accent/80 transition-colors"
                                aria-label="Open link"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                          {resource.description && (
                            <p className="text-xs font-mono text-foreground-muted leading-relaxed">
                              {resource.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Checklist Layout - Items with checkboxes and progress tracking
 */
function ChecklistLayout({ resources }: { resources: ExtractedResource[] }) {
  const [checked, setChecked] = useState<Set<number>>(() => new Set())

  const toggleItem = (index: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const completedCount = checked.size
  const totalCount = resources.length
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted">
          Checklist
        </h2>
        <span className="text-xs font-mono text-foreground-muted">
          {completedCount}/{totalCount} completed
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-background-emphasis rounded-none mb-3 overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="bg-background border border-border rounded-none divide-y divide-border">
        {resources.map((resource, index) => {
          const isChecked = checked.has(index)
          return (
            <div
              key={index}
              className={cn(
                'p-4 transition-colors cursor-pointer hover:bg-background-emphasis/30',
                isChecked && 'bg-background-muted/50'
              )}
              onClick={() => toggleItem(index)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggleItem(index)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        'text-sm font-mono font-medium transition-all',
                        isChecked
                          ? 'text-foreground-muted line-through'
                          : 'text-foreground'
                      )}
                    >
                      {resource.name}
                    </span>
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent/80 transition-colors"
                        aria-label="Open link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                  {resource.description && (
                    <p
                      className={cn(
                        'text-xs font-mono leading-relaxed transition-all',
                        isChecked
                          ? 'text-foreground-muted/60 line-through'
                          : 'text-foreground-muted'
                      )}
                    >
                      {resource.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Cards Layout - Larger cards with full details
 */
function CardsLayout({ resources }: { resources: ExtractedResource[] }) {
  return (
    <section className="mb-8">
      <h2 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-3">
        Resources ({resources.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resources.map((resource, index) => (
          <div
            key={index}
            className="bg-background border border-border rounded-none p-4 hover:border-border-emphasis transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 size-10 bg-background-emphasis border border-border rounded-none flex items-center justify-center text-foreground-muted">
                {getCategoryIcon(resource.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-mono font-medium text-foreground">
                    {resource.name}
                  </span>
                  {resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:text-accent/80 transition-colors"
                      aria-label="Open link"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
                {resource.category && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[9px] font-mono font-medium uppercase tracking-wider bg-background-emphasis text-foreground-muted border border-border mb-2">
                    {getCategoryLabel(resource.category)}
                  </span>
                )}
                {resource.description && (
                  <p className="text-xs font-mono text-foreground-muted leading-relaxed">
                    {resource.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Table Layout - Responsive table with columns
 */
function TableLayout({ resources }: { resources: ExtractedResource[] }) {
  // Determine which columns to show
  const hasCategories = resources.some((r) => r.category)
  const hasUrls = resources.some((r) => r.url)
  const hasDescriptions = resources.some((r) => r.description)

  return (
    <section className="mb-8">
      <h2 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-3">
        Resources ({resources.length})
      </h2>
      <div className="bg-background border border-border rounded-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background-emphasis/50">
                <th className="px-4 py-3 text-left text-[10px] font-mono font-medium uppercase tracking-wider text-foreground-muted w-12">
                  #
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-mono font-medium uppercase tracking-wider text-foreground-muted">
                  Name
                </th>
                {hasCategories && (
                  <th className="px-4 py-3 text-left text-[10px] font-mono font-medium uppercase tracking-wider text-foreground-muted">
                    Type
                  </th>
                )}
                {hasDescriptions && (
                  <th className="px-4 py-3 text-left text-[10px] font-mono font-medium uppercase tracking-wider text-foreground-muted hidden md:table-cell">
                    Description
                  </th>
                )}
                {hasUrls && (
                  <th className="px-4 py-3 text-left text-[10px] font-mono font-medium uppercase tracking-wider text-foreground-muted w-24">
                    Link
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {resources.map((resource, index) => (
                <tr key={index} className="hover:bg-background-emphasis/30 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-foreground-muted">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono font-medium text-foreground">
                    {resource.name}
                  </td>
                  {hasCategories && (
                    <td className="px-4 py-3">
                      {resource.category && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[9px] font-mono font-medium uppercase tracking-wider bg-background-emphasis text-foreground-muted border border-border">
                          {getCategoryLabel(resource.category)}
                        </span>
                      )}
                    </td>
                  )}
                  {hasDescriptions && (
                    <td className="px-4 py-3 text-xs font-mono text-foreground-muted max-w-md truncate hidden md:table-cell">
                      {resource.description}
                    </td>
                  )}
                  {hasUrls && (
                    <td className="px-4 py-3">
                      {resource.url && (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-mono text-accent hover:text-accent/80 transition-colors"
                        >
                          <ExternalLink className="size-3" />
                          <span className="sr-only">Open link</span>
                        </a>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

/**
 * Display a list of extracted resources with layout based on hint
 */
export function ResourceList({ resources, layoutHint }: ResourceListProps) {
  if (!resources || resources.length === 0) {
    return null
  }

  const layout = layoutHint ?? 'simple-list'

  switch (layout) {
    case 'numbered-steps':
      return <NumberedStepsLayout resources={resources} />
    case 'grid':
      return <GridLayout resources={resources} />
    case 'accordion':
      return <AccordionLayout resources={resources} />
    case 'checklist':
      return <ChecklistLayout resources={resources} />
    case 'cards':
      return <CardsLayout resources={resources} />
    case 'table':
      return <TableLayout resources={resources} />
    case 'simple-list':
    default:
      return <SimpleListLayout resources={resources} />
  }
}
