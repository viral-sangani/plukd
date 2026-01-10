import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

const Toggle = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  ToggleProps
>(({ checked, onChange, label, disabled, ...props }, ref) => {
  return (
    <div className="tw-flex tw-items-center tw-gap-2">
      <SwitchPrimitives.Root
        ref={ref}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className={cn(
          "tw-peer tw-inline-flex tw-h-6 tw-w-11 tw-shrink-0 tw-cursor-pointer tw-items-center tw-rounded-full tw-border-2 tw-border-transparent tw-shadow-sm tw-transition-colors",
          "focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring focus-visible:tw-ring-offset-2 focus-visible:tw-ring-offset-background",
          "disabled:tw-cursor-not-allowed disabled:tw-opacity-50",
          "tw-bg-vibed-gray-800 data-[state=checked]:tw-bg-vibed-orange"
        )}
        {...props}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            "tw-pointer-events-none tw-block tw-h-5 tw-w-5 tw-rounded-full tw-bg-white tw-shadow-lg tw-ring-0 tw-transition-transform",
            "data-[state=checked]:tw-translate-x-5 data-[state=unchecked]:tw-translate-x-0"
          )}
        />
      </SwitchPrimitives.Root>
      {label && (
        <label className="tw-text-sm tw-font-medium tw-text-vibed-white tw-cursor-pointer">
          {label}
        </label>
      )}
    </div>
  )
})

Toggle.displayName = "Toggle"

export { Toggle }
