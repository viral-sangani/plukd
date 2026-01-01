"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, Check } from "lucide-react";
import { useState, FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type FormState = "idle" | "loading" | "success" | "error";

export function EmailLoginForm() {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim()) {
      setFormState("error");
      setErrorMessage("Please enter your email address");
      return;
    }

    setFormState("loading");
    setErrorMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (error) {
        console.error("Error sending magic link:", error.message);
        setFormState("error");
        setErrorMessage(error.message);
        return;
      }

      setFormState("success");
    } catch (error) {
      console.error("Error sending magic link:", error);
      setFormState("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
    }
  };

  if (formState === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#22c55e]/10">
          <Check className="h-6 w-6 text-[#22c55e]" />
        </div>
        <div className="text-center">
          <p className="font-mono font-medium text-[#fafaf9]">Check your email</p>
          <p className="mt-1 text-sm font-mono text-[#a8a29e]">
            We sent a magic link to <span className="text-[#fafaf9]">{email}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormState("idle");
            setEmail("");
          }}
          className="text-sm font-mono text-[#78716c] hover:text-[#a8a29e] transition-colors"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-mono font-medium text-[#a8a29e]">
          Email address
        </label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (formState === "error") {
              setFormState("idle");
              setErrorMessage("");
            }
          }}
          disabled={formState === "loading"}
          className="h-12 font-mono bg-[#0c0a09] border-[#44403c] text-[#fafaf9] placeholder:text-[#57534e] focus-visible:border-[#fafaf9] focus-visible:ring-[#fafaf9]/20"
          autoComplete="email"
          autoFocus
        />
      </div>

      {formState === "error" && errorMessage && (
        <p className="text-sm font-mono text-red-500">{errorMessage}</p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full font-mono bg-[#fafaf9] text-[#0c0a09] hover:bg-[#e7e5e4] border-0 font-medium h-12"
        disabled={formState === "loading"}
      >
        {formState === "loading" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Mail className="h-5 w-5 mr-2" />
            Send Magic Link
          </>
        )}
      </Button>
    </form>
  );
}
