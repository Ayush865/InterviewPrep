/**
 * app/(root)/settings/billing/page.tsx
 *
 * Billing page: current plan, monthly usage, upgrade / manage actions.
 */

import dayjs from "dayjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Check, KeyRound, AlertTriangle } from "lucide-react";

import UpgradeButton from "@/components/UpgradeButton";
import {
  getUserEntitlements,
  getSubscriptionSummary,
} from "@/lib/actions/premium.action";
import { PRO_PRICE_USD } from "@/lib/plans";
import { isVapiByokEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const planLabel = {
  free: "Free",
  pro: "Pro",
  byok: "Your Vapi key",
} as const;

function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  if (limit === null) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-strong">{label}</p>
          <p className="text-sm text-faint">Unlimited</p>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((used / limit) * 100));
  const exhausted = used >= limit;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-strong">{label}</p>
        <p
          className={cn(
            "text-sm tabular-nums",
            exhausted ? "font-semibold text-accent" : "text-faint"
          )}
        >
          {used} / {limit}
        </p>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-raise"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={label}
      >
        <div
          className={cn(
            "h-full rounded-full",
            exhausted ? "bg-accent" : "bg-emerald-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ userId }, params] = await Promise.all([auth(), searchParams]);
  if (!userId) redirect("/sign-in");

  const [entitlements, subscription] = await Promise.all([
    getUserEntitlements(userId),
    getSubscriptionSummary(userId),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl pb-24 pt-12 max-sm:pt-8">
      <header>
        <h1 className="display text-3xl">Billing</h1>
        <p className="mt-2 text-soft">
          Your plan, monthly usage, and subscription settings.
        </p>
      </header>

      {params.status === "success" && (
        <div className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Welcome to Pro! Your subscription is active — it can take a few
            seconds to reflect here after checkout.
          </p>
        </div>
      )}
      {params.status === "canceled" && (
        <div className="mt-6 rounded-xl border border-hairline bg-raise px-4 py-3">
          <p className="text-sm text-soft">
            Checkout canceled — no charge was made.
          </p>
        </div>
      )}

      {/* Current plan */}
      <div className="panel mt-8 p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-faint">Current plan</p>
            <p className="mt-1 flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-strong">
              {planLabel[entitlements.plan]}
              {entitlements.plan === "pro" && (
                <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                  ${PRO_PRICE_USD}/mo
                </span>
              )}
            </p>
          </div>
          {entitlements.plan === "byok" && (
            <div className="icon-tile size-11">
              <KeyRound className="size-5 text-accent" aria-hidden="true" />
            </div>
          )}
        </div>

        {entitlements.plan === "pro" && entitlements.periodEnd && (
          <p className="mt-3 text-sm text-soft">
            {entitlements.cancelAtPeriodEnd ? (
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle
                  className="size-4 text-amber-600 dark:text-amber-400"
                  aria-hidden="true"
                />
                Cancels on {dayjs(entitlements.periodEnd).format("MMM D, YYYY")}{" "}
                — you keep Pro until then.
              </span>
            ) : (
              <>Renews on {dayjs(entitlements.periodEnd).format("MMM D, YYYY")}.</>
            )}
          </p>
        )}
        {entitlements.plan === "byok" && (
          <p className="mt-3 text-sm text-soft">
            You&apos;re using your own Vapi credentials — unlimited interviews
            and sessions, billed to your Vapi account.
          </p>
        )}
        {subscription.hasSubscription &&
          subscription.status &&
          !["active", "trialing"].includes(subscription.status) && (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
              Subscription status: {subscription.status}. Update your payment
              method to restore Pro access.
            </p>
          )}

        {/* Usage */}
        <div className="mt-6 flex flex-col gap-5 border-t border-hairline pt-6">
          <UsageMeter
            label={
              entitlements.plan === "pro"
                ? "Interview generations this period"
                : "Interview generations"
            }
            used={entitlements.generationsUsed}
            limit={entitlements.generationsLimit}
          />
          <UsageMeter
            label={
              entitlements.plan === "pro"
                ? "Practice sessions this period"
                : "Practice sessions"
            }
            used={entitlements.sessionsUsed}
            limit={entitlements.sessionsLimit}
          />
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {entitlements.plan === "pro" || subscription.hasSubscription ? (
            <UpgradeButton mode="portal" className="btn-quiet flex-1" />
          ) : (
            <UpgradeButton className="flex-1" />
          )}
          {isVapiByokEnabled() && (
            <Link href="/settings/vapi" className="btn-quiet flex-1">
              <KeyRound className="size-4" aria-hidden="true" />
              Use my own Vapi key
            </Link>
          )}
        </div>
      </div>

      {/* Pro pitch for non-subscribers */}
      {entitlements.plan === "free" && (
        <div className="panel mt-4 p-7">
          <h2 className="text-sm font-semibold tracking-tight text-strong">
            What you get with Pro
          </h2>
          <ul className="mt-4 flex list-none flex-col gap-2.5">
            {[
              "10 interview generations every month",
              "10 practice sessions every month (30 minutes each)",
              "Cancel anytime — keep access until the period ends",
            ].map((perk) => (
              <li
                key={perk}
                className="flex items-center gap-2.5 text-sm text-body"
              >
                <Check
                  className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                {perk}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
