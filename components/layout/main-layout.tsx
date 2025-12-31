import { Sidebar } from "./sidebar"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-[#09090b]">
      <Sidebar />
      <main className="flex-1 overflow-auto pt-14 lg:pt-0 p-4 lg:p-6 lg:pl-[calc(256px+1.5rem)]">
        {children}
      </main>
    </div>
  )
}
