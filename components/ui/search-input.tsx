'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
  showShortcut?: boolean
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  debounceMs = 300,
  className,
  showShortcut = true,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync local value with external value
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Keyboard shortcut handler (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const debouncedOnChange = useCallback(
    (newValue: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        onChange(newValue)
      }, debounceMs)
    },
    [onChange, debounceMs]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    debouncedOnChange(newValue)
  }

  const handleClear = () => {
    setLocalValue('')
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={cn('relative group', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground-muted pointer-events-none group-focus-within:text-accent transition-colors" />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          'w-full h-10 pl-10 pr-20 rounded-none border text-sm font-mono',
          'bg-background-subtle border-border text-foreground',
          'placeholder:text-foreground-muted placeholder:font-mono',
          'focus:outline-none focus:border-accent focus:ring-[2px] focus:ring-accent/20',
          'transition-[color,box-shadow,border-color]'
        )}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              'p-0.5 rounded-sm',
              'text-foreground-muted hover:text-accent hover:bg-accent/10',
              'transition-colors'
            )}
          >
            <X className="size-4" />
            <span className="sr-only">Clear search</span>
          </button>
        )}
        {showShortcut && !localValue && (
          <kbd className="kbd">
            <span className="text-[10px]">⌘</span>K
          </kbd>
        )}
      </div>
    </div>
  )
}
