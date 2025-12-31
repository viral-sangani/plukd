'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface BackButtonProps {
  href?: string
  label?: string
  className?: string
}

export function BackButton({ href, label = 'Back', className }: BackButtonProps) {
  const router = useRouter()

  if (href) {
    return (
      <Button
        variant="ghost"
        size="sm"
        asChild
        className={cn('gap-2 text-foreground-secondary hover:text-foreground', className)}
      >
        <Link href={href}>
          <ArrowLeft className="size-4" />
          <span>{label}</span>
        </Link>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.back()}
      className={cn('gap-2 text-foreground-secondary hover:text-foreground', className)}
    >
      <ArrowLeft className="size-4" />
      <span>{label}</span>
    </Button>
  )
}
