"use client";

import Link from "next/link";
import { Loader2, Lock, Settings, Sparkles } from "lucide-react";
import UpgradeButton from "@/components/UpgradeButton";
import type { Plan } from "@/lib/plans";
import { isVapiByokEnabled } from "@/lib/feature-flags";

/** Centered loading state while gate data resolves */
export const GateLoading = () => (
  <div
    className="flex h-[60vh] items-center justify-center"
    role="status"
    aria-label="Loading"
  >
    <Loader2 className="size-6 animate-spin text-faint" aria-hidden="true" />
  </div>
);

/** Shown when the visitor isn't signed in */
export const GateAuthRequired = () => (
  <div className="flex h-[60vh] flex-col items-center justify-center gap-5 text-center">
    <div className="flex size-12 items-center justify-center rounded-full border border-hairline bg-raise">
      <Lock className="size-5 text-soft" aria-hidden="true" />
    </div>
    <div>
      <h2 className="display text-2xl">Sign in to continue</h2>
      <p className="mt-2 max-w-sm text-soft">
        You need an account to generate interviews.
      </p>
    </div>
    <Link href="/sign-in" className="btn-cta">
      Sign in
    </Link>
  </div>
);

/** Shown when the plan's generation limit is reached */
export const GateLimitReached = ({
  plan = "free",
  context = "form",
}: {
  plan?: Plan;
  context?: "form" | "call";
}) => {
  const byok = isVapiByokEnabled();

  const description =
    plan === "pro"
      ? `You've used all 10 interview generations for this billing period. Your quota resets on renewal${byok ? ", or connect your own Vapi key for unlimited access" : ""}.`
      : context === "call"
        ? `The free plan includes 1 interview generated with the hiring manager, and you've used it. The form is unlimited — or upgrade to Pro for 10 call generations a month${byok ? ", or connect your own Vapi key" : ""}.`
        : `You've reached your free generation limit. Upgrade to Pro for 10 interviews a month${byok ? ", or connect your own Vapi key for unlimited access" : ""}.`;

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-16">
      <div className="panel flex max-w-lg flex-col items-center gap-6 px-10 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
          <Sparkles className="size-5 text-accent" aria-hidden="true" />
        </div>
        <div>
          <h2 className="display text-2xl">
            {plan === "pro" ? "Monthly quota used" : "Free plan limit reached"}
          </h2>
          <p className="mt-3 leading-relaxed text-soft">{description}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          {plan === "free" && context === "call" && (
            <Link href="/interview" className="btn-cta !h-10 text-sm">
              Use the form instead
            </Link>
          )}
          {plan !== "pro" && <UpgradeButton className="!h-10 text-sm" />}
          {byok && (
            <Link href="/settings/vapi" className="btn-quiet !h-10 text-sm">
              <Settings className="size-4" aria-hidden="true" />
              Use my Vapi key
            </Link>
          )}
        </div>
        <Link
          href="/"
          className="text-sm text-faint transition-colors duration-200 hover:text-strong"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
};
