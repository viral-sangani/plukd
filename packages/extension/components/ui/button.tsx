import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "tw-inline-flex tw-items-center tw-justify-center tw-gap-2 tw-whitespace-nowrap tw-text-sm tw-font-medium tw-font-mono tw-transition-colors focus-visible:tw-outline-none focus-visible:tw-ring-1 focus-visible:tw-ring-ring disabled:tw-pointer-events-none disabled:tw-opacity-50 [&_svg]:tw-pointer-events-none [&_svg]:tw-size-4 [&_svg]:tw-shrink-0",
  {
    variants: {
      variant: {
        default:
          "tw-bg-plukd-accent tw-text-white tw-rounded-none tw-shadow hover:tw-bg-plukd-accent-hover tw-uppercase tw-tracking-wider tw-text-xs",
        plukd:
          "tw-bg-plukd-accent tw-text-white tw-rounded-none tw-shadow hover:tw-bg-plukd-accent-hover tw-uppercase tw-tracking-wider tw-text-xs",
        destructive:
          "tw-bg-destructive tw-text-destructive-foreground tw-rounded-none tw-shadow-sm hover:tw-bg-destructive/90",
        outline:
          "tw-border tw-border-plukd-border tw-bg-transparent tw-rounded-none tw-shadow-sm hover:tw-bg-white/5 hover:tw-border-plukd-accent hover:tw-text-plukd-accent tw-text-plukd-foreground-secondary",
        secondary:
          "tw-bg-plukd-bg-subtle tw-text-plukd-foreground tw-rounded-none tw-shadow-sm hover:tw-bg-plukd-bg-muted",
        ghost: "hover:tw-bg-white/5 hover:tw-text-plukd-accent tw-text-plukd-foreground-secondary",
        link: "tw-text-plukd-accent tw-underline-offset-4 hover:tw-underline",
      },
      size: {
        default: "tw-h-9 tw-px-4 tw-py-2",
        sm: "tw-h-8 tw-px-3 tw-text-xs",
        lg: "tw-h-10 tw-px-8",
        icon: "tw-h-9 tw-w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
