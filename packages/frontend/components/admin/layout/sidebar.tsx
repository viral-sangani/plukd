'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Cpu,
  Database,
  Sparkles,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    label: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Processing',
    href: '/admin/processing',
    icon: Cpu,
  },
  {
    label: 'Embeddings',
    href: '/admin/embeddings',
    icon: Database,
  },
  {
    label: 'AI Summaries',
    href: '/admin/ai-summaries',
    icon: Sparkles,
  },
  {
    label: 'Errors',
    href: '/admin/errors',
    icon: AlertCircle,
  },
]

interface AdminSidebarProps {
  className?: string
}

export function AdminSidebar({ className }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'w-56 bg-black border-r border-zinc-900 flex flex-col',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-900">
        <Link
          href="/"
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors group"
        >
          <ChevronLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-xs font-mono">Back to App</span>
        </Link>
      </div>

      {/* Logo */}
      <div className="px-4 py-6 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <span className="text-lg font-mono font-medium text-white">
            Plukd
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 bg-zinc-900 px-1.5 py-0.5">
            Admin
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm font-mono transition-all',
                    isActive
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-900/50'
                  )}
                >
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-900">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-600">
            Press{' '}
            <kbd className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 font-mono text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 rounded">
              R
            </kbd>{' '}
            to refresh
          </span>
        </div>
      </div>
    </aside>
  )
}
