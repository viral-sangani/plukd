import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base styles - dark background, square corners, monospace
        "h-9 w-full min-w-0 rounded-none border px-3 py-1 text-base md:text-sm font-mono",
        "bg-background-subtle border-border text-foreground",
        "placeholder:text-foreground-muted placeholder:font-mono",
        // File input styles
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:font-mono",
        // Selection styles
        "selection:bg-accent/30 selection:text-foreground",
        // Focus states - coral accent
        "outline-none transition-[color,box-shadow,border-color]",
        "focus-visible:border-accent focus-visible:ring-[2px] focus-visible:ring-accent/20",
        // Invalid states
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        // Disabled states
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
