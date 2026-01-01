import Image from "next/image";
import { AuthCard } from "@/components/auth/auth-card";
import { EmailLoginForm } from "@/components/auth/email-login-form";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error;

  return (
    <div className="flex flex-col items-center gap-8 px-4">
      {/* Logo and tagline */}
      <div className="flex flex-col items-center text-center">
        <Image
          src="/icon.png"
          alt="Plukd"
          width={64}
          height={64}
          className="rounded-xl mb-4"
        />
        <h1 className="font-cal text-4xl font-semibold tracking-tight text-[#fafaf9]">
          Plukd
        </h1>
        <p className="mt-2 text-[#78716c]">
          Your personal knowledge capture system
        </p>
      </div>

      {/* Auth card */}
      <AuthCard>
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-[#fafaf9]">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-[#a8a29e]">
              Sign in to your account to continue
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-center text-sm text-red-500">
              {error === "auth_callback_error"
                ? "Authentication failed. Please try again."
                : "An error occurred. Please try again."}
            </div>
          )}

          <GoogleLoginButton />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#44403c]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#1a1a1a] px-2 text-[#78716c]">
                or continue with email
              </span>
            </div>
          </div>

          <EmailLoginForm />

          <p className="text-center text-xs text-[#78716c]">
            By signing in, you agree to our{" "}
            <a href="/terms" className="underline hover:text-[#a8a29e]">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline hover:text-[#a8a29e]">
              Privacy Policy
            </a>
          </p>
        </div>
      </AuthCard>
    </div>
  );
}
