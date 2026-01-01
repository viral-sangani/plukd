"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      className="toaster group font-mono"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        style: {
          background: "#111111",
          border: "1px solid #1f1f1f",
          color: "#fafafa",
          borderRadius: "0",
          fontFamily: "var(--font-mono)",
        },
        classNames: {
          toast: "rounded-none",
          title: "text-sm font-medium",
          description: "text-xs text-[#a1a1aa]",
          success: "[&>svg]:text-accent",
          error: "[&>svg]:text-red-500",
          warning: "[&>svg]:text-amber-500",
          info: "[&>svg]:text-accent",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
