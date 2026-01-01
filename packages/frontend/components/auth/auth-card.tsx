import { cn } from "@/lib/utils";

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-md rounded-xl border border-[#262626] bg-[#1a1a1a] p-8",
        className
      )}
    >
      {children}
    </div>
  );
}
