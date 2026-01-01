'use client'

import { useState } from 'react'
import { Check, ChevronDown, X, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  SOURCE_LABELS,
  PROCESSING_STATUS_LABELS,
} from '@plukd/shared'
import type { Category, ContentSource, ProcessingStatus } from '@plukd/shared'
import { cn } from '@/lib/utils'

export interface BookmarkFiltersState {
  category: Category | null
  source: ContentSource | null
  status: ProcessingStatus | null
}

interface BookmarkFiltersProps {
  selectedCategory: Category | null
  selectedSource: ContentSource | null
  selectedStatus: ProcessingStatus | null
  onCategoryChange: (category: Category | null) => void
  onSourceChange: (source: ContentSource | null) => void
  onStatusChange: (status: ProcessingStatus | null) => void
  onClearAll: () => void
  className?: string
}

const SOURCES: ContentSource[] = ['twitter', 'reddit', 'linkedin', 'youtube', 'web']
const STATUSES: ProcessingStatus[] = ['pending', 'processing', 'completed', 'failed']

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  getLabel,
  onChange,
  placeholder = 'Search...',
}: {
  label: string
  value: T | null
  options: readonly T[]
  getLabel: (option: T) => string
  onChange: (value: T | null) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 border-border-subtle bg-background-muted hover:bg-background-emphasis',
            'text-foreground-secondary hover:text-foreground',
            value && 'border-accent text-foreground'
          )}
        >
          {value ? getLabel(value) : label}
          <ChevronDown className="size-3.5 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onChange(option === value ? null : option)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      value === option ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {getLabel(option)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ActiveFilterChip({
  label,
  value,
  onRemove,
}: {
  label: string
  value: string
  onRemove: () => void
}) {
  return (
    <Badge
      variant="secondary"
      className="h-6 gap-1 pl-2 pr-1 bg-background-emphasis border border-border-subtle text-foreground-secondary hover:bg-background-muted transition-colors"
    >
      <span className="text-[10px] font-mono uppercase text-foreground-muted">
        {label}:
      </span>
      <span className="text-xs">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-sm p-0.5 hover:bg-background-subtle hover:text-foreground transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="size-3" />
      </button>
    </Badge>
  )
}

export function BookmarkFilters({
  selectedCategory,
  selectedSource,
  selectedStatus,
  onCategoryChange,
  onSourceChange,
  onStatusChange,
  onClearAll,
  className,
}: BookmarkFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const hasFilters =
    selectedCategory !== null ||
    selectedSource !== null ||
    selectedStatus !== null

  const activeFilterCount = [selectedCategory, selectedSource, selectedStatus].filter(
    Boolean
  ).length

  return (
    <div className={cn('space-y-3', className)}>
      {/* Desktop Filters */}
      <div className="hidden md:flex items-center gap-3">
        {/* Source Filter */}
        <FilterDropdown
          label="Source"
          value={selectedSource}
          options={SOURCES}
          getLabel={(source) => SOURCE_LABELS[source]}
          onChange={onSourceChange}
          placeholder="Search sources..."
        />

        {/* Category Filter */}
        <FilterDropdown
          label="Category"
          value={selectedCategory}
          options={CATEGORIES}
          getLabel={(category) => CATEGORY_LABELS[category]}
          onChange={onCategoryChange}
          placeholder="Search categories..."
        />

        {/* Status Filter */}
        <FilterDropdown
          label="Status"
          value={selectedStatus}
          options={STATUSES}
          getLabel={(status) => PROCESSING_STATUS_LABELS[status]}
          onChange={onStatusChange}
          placeholder="Search status..."
        />
      </div>

      {/* Mobile Filters */}
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 border-border-subtle bg-background-muted hover:bg-background-emphasis',
                'text-foreground-secondary hover:text-foreground',
                hasFilters && 'border-accent text-foreground'
              )}
            >
              <SlidersHorizontal className="size-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-accent text-accent-foreground"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh]">
            <SheetHeader className="pb-4">
              <SheetTitle className="text-left font-mono text-sm uppercase tracking-wider">
                Filter Bookmarks
              </SheetTitle>
            </SheetHeader>
            <div className="space-y-4 pb-6">
              {/* Source */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-foreground-muted">
                  Source
                </label>
                <div className="flex flex-wrap gap-2">
                  {SOURCES.map((source) => (
                    <Button
                      key={source}
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onSourceChange(source === selectedSource ? null : source)
                      }
                      className={cn(
                        'h-8 border-border-subtle',
                        selectedSource === source &&
                          'border-accent bg-accent/10 text-foreground'
                      )}
                    >
                      {SOURCE_LABELS[source]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-foreground-muted">
                  Category
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {CATEGORIES.map((category) => (
                    <Button
                      key={category}
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onCategoryChange(
                          category === selectedCategory ? null : category
                        )
                      }
                      className={cn(
                        'h-8 border-border-subtle',
                        selectedCategory === category &&
                          'border-accent bg-accent/10 text-foreground'
                      )}
                    >
                      {CATEGORY_LABELS[category]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-foreground-muted">
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((status) => (
                    <Button
                      key={status}
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onStatusChange(status === selectedStatus ? null : status)
                      }
                      className={cn(
                        'h-8 border-border-subtle',
                        selectedStatus === status &&
                          'border-accent bg-accent/10 text-foreground'
                      )}
                    >
                      {PROCESSING_STATUS_LABELS[status]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                {hasFilters && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      onClearAll()
                      setMobileOpen(false)
                    }}
                  >
                    Clear all
                  </Button>
                )}
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => setMobileOpen(false)}
                >
                  Apply filters
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Filters (shown on both mobile and desktop) */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedSource && (
            <ActiveFilterChip
              label="Source"
              value={SOURCE_LABELS[selectedSource]}
              onRemove={() => onSourceChange(null)}
            />
          )}
          {selectedCategory && (
            <ActiveFilterChip
              label="Category"
              value={CATEGORY_LABELS[selectedCategory]}
              onRemove={() => onCategoryChange(null)}
            />
          )}
          {selectedStatus && (
            <ActiveFilterChip
              label="Status"
              value={PROCESSING_STATUS_LABELS[selectedStatus]}
              onRemove={() => onStatusChange(null)}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-6 px-2 text-xs text-foreground-muted hover:text-foreground"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
