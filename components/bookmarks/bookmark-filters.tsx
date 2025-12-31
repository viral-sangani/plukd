'use client'

import { useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { CATEGORIES, CATEGORY_LABELS, SOURCE_LABELS } from '@/lib/constants'
import type { Category, ContentSource } from '@/types'
import { cn } from '@/lib/utils'

interface BookmarkFiltersProps {
  selectedCategory: Category | null
  selectedSource: ContentSource | null
  onCategoryChange: (category: Category | null) => void
  onSourceChange: (source: ContentSource | null) => void
  className?: string
}

const SOURCES: ContentSource[] = ['twitter', 'reddit', 'linkedin', 'youtube', 'web']

export function BookmarkFilters({
  selectedCategory,
  selectedSource,
  onCategoryChange,
  onSourceChange,
  className,
}: BookmarkFiltersProps) {
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)

  const hasFilters = selectedCategory !== null || selectedSource !== null

  const clearFilters = () => {
    onCategoryChange(null)
    onSourceChange(null)
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Category Filter */}
      <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 border-border-subtle bg-background-muted hover:bg-background-emphasis',
              'text-foreground-secondary hover:text-foreground',
              selectedCategory && 'border-accent text-foreground'
            )}
          >
            {selectedCategory ? CATEGORY_LABELS[selectedCategory] : 'Category'}
            <ChevronDown className="size-3.5 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList>
              <CommandEmpty>No category found.</CommandEmpty>
              <CommandGroup>
                {CATEGORIES.map((category) => (
                  <CommandItem
                    key={category}
                    value={category}
                    onSelect={() => {
                      onCategoryChange(
                        category === selectedCategory ? null : category
                      )
                      setCategoryOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 size-4',
                        selectedCategory === category
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    {CATEGORY_LABELS[category]}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Source Filter */}
      <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 border-border-subtle bg-background-muted hover:bg-background-emphasis',
              'text-foreground-secondary hover:text-foreground',
              selectedSource && 'border-accent text-foreground'
            )}
          >
            {selectedSource ? SOURCE_LABELS[selectedSource] : 'Source'}
            <ChevronDown className="size-3.5 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[180px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search sources..." />
            <CommandList>
              <CommandEmpty>No source found.</CommandEmpty>
              <CommandGroup>
                {SOURCES.map((source) => (
                  <CommandItem
                    key={source}
                    value={source}
                    onSelect={() => {
                      onSourceChange(source === selectedSource ? null : source)
                      setSourceOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 size-4',
                        selectedSource === source ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {SOURCE_LABELS[source]}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Clear Filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-8 px-2 text-foreground-muted hover:text-foreground"
        >
          <X className="size-3.5 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
