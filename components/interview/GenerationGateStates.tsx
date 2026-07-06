"use client";

import Link from "next/link";
import { Loader2, Lock, Settings, Sparkles } from "lucide-react";

/** Centered loading state while gate data resolves */
export const GateLoading = () => (
  <div
    className="flex h-[60vh] items-center justify-center"
    role="status"
    aria-label="Loading"
  >
    <Loader2 className="size-6 animate-spin text-zinc-500" aria-hidden="true" />
  </div>
);

/** Shown when the visitor isn't signed in */
export const GateAuthRequired = () => (
  <div className="flex h-[60vh] flex-col items-center justify-center gap-5 text-center">
    <div className="flex size-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
      <Lock className="size-5 text-zinc-400" aria-hidden="true" />
    </div>
    <div>
      <h2 className="display text-2xl">Sign in to continue</h2>
      <p className="mt-2 max-w-sm text-zinc-400">
        You need an account to generate interviews.
      </p>
    </div>
    <Link href="/sign-in" className="btn-cta">
      Sign in
    </Link>
  </div>
);

/** Shown when the free-plan generation limit is reached */
export const GateLimitReached = () => (
  <div className="flex min-h-[60vh] items-center justify-center py-16">
    <div className="panel flex max-w-lg flex-col items-center gap-6 px-10 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
        <Sparkles className="size-5 text-accent" aria-hidden="true" />
      </div>
      <div>
        <h2 className="display text-2xl">Free plan limit reached</h2>
        <p className="mt-3 leading-relaxed text-zinc-400">
          You&apos;ve used your free interview generation. Connect your own
          Vapi key or upgrade to Premium for unlimited interviews.
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/settings/vapi" className="btn-quiet !h-10 text-sm">
          <Settings className="size-4" aria-hidden="true" />
          Use my Vapi key
        </Link>
        <button type="button" className="btn-accent !h-10 text-sm">
          Upgrade to Premium
        </button>
      </div>
      <Link
        href="/"
        className="text-sm text-zinc-500 transition-colors duration-200 hover:text-white"
      >
        Back to dashboard
      </Link>
    </div>
  </div>
);
