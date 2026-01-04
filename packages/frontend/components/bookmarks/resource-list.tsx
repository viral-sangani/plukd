'use client'

import { ExternalLink, Book, Wrench, Film, Tv, Headphones, GraduationCap, Package } from 'lucide-react'
import type { ExtractedResource } from '@plukd/shared/types'

interface ResourceListProps {
  resources: ExtractedResource[]
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
  // Capitalize first letter
  return category.charAt(0).toUpperCase() + category.slice(1)
}

/**
 * Display a list of extracted resources from list-type content
 */
export function ResourceList({ resources }: ResourceListProps) {
  if (!resources || resources.length === 0) {
    return null
  }

  return (
    <section className="mb-8">
      <h2 className="text-[10px] font-mono font-medium uppercase tracking-[0.15em] text-foreground-muted mb-3">
        Extracted Resources ({resources.length})
      </h2>
      <div className="bg-background border border-border rounded-none divide-y divide-border">
        {resources.map((resource, index) => (
          <div key={index} className="p-4">
            <div className="flex items-start gap-3">
              {/* Category icon */}
              <div className="flex-shrink-0 mt-0.5 text-foreground-muted">
                {getCategoryIcon(resource.category)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-mono font-medium text-foreground">
                    {resource.name}
                  </span>
                  {resource.category && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[9px] font-mono font-medium uppercase tracking-wider bg-background-emphasis text-foreground-muted border border-border">
                      {getCategoryLabel(resource.category)}
                    </span>
                  )}
                </div>

                {resource.description && (
                  <p className="text-xs font-mono text-foreground-muted leading-relaxed">
                    {resource.description}
                  </p>
                )}

                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs font-mono text-accent hover:text-accent/80 transition-colors"
                  >
                    <ExternalLink className="size-3" />
                    <span className="truncate max-w-[200px]">
                      {new URL(resource.url).hostname.replace(/^www\./, '')}
                    </span>
                  </a>
                )}
              </div>

              {/* Index number */}
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
