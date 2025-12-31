import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-[#fafaf9]" />
      <p className="text-[#a8a29e]">Signing you in...</p>
    </div>
  );
}
