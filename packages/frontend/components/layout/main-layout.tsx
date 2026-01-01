import Link from "next/link"
import { TopNav } from "./top-nav"

interface MainLayoutProps {
  children: React.ReactNode
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-foreground-muted uppercase tracking-wider">
              Plukd
            </span>
            <span className="text-xs font-mono text-foreground-muted/50">
              v1.0.0
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="https://plukd.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-foreground-muted hover:text-accent transition-colors"
            >
              plukd.xyz
            </Link>
            <span className="text-xs font-mono text-foreground-muted/50">
              © {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />
      <main className="pt-14 flex-1">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}
