/**
 * app/(root)/settings/billing/page.tsx
 *
 * Billing page: current plan, monthly usage, upgrade / manage actions.
 */

import dayjs from "dayjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { KeyRound, AlertTriangle } from "lucide-react";

import UpgradeButton from "@/components/UpgradeButton";
import PricingTiers from "@/components/billing/PricingTiers";
import {
  getUserEntitlements,
  getSubscriptionSummary,
} from "@/lib/actions/premium.action";
import { PLAN_PRICES } from "@/lib/plans";
import { getPaymentProvider } from "@/lib/payments";
import { isVapiByokEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const planLabel = {
  free: "Free",
  pro: "Pro",
  elite: "Elite",
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

  // The subscription's own provider wins; fall back to the configured one
  const provider = subscription.provider ?? getPaymentProvider();
  const currency = provider === "razorpay" ? ("inr" as const) : ("usd" as const);
  const paidPlan = entitlements.plan === "elite" ? "elite" : "pro";
  const monthlyPrice = PLAN_PRICES[paidPlan].monthly[currency];
  const priceLabel =
    currency === "inr" ? `₹${monthlyPrice}/mo` : `$${monthlyPrice}/mo`;

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
              {(entitlements.plan === "pro" || entitlements.plan === "elite") && (
                <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                  {priceLabel}
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

        {entitlements.isPremium && entitlements.periodEnd && (
          <p className="mt-3 text-sm text-soft">
            {entitlements.cancelAtPeriodEnd ? (
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle
                  className="size-4 text-amber-600 dark:text-amber-400"
                  aria-hidden="true"
                />
                Cancels on {dayjs(entitlements.periodEnd).format("MMM D, YYYY")}{" "}
                — you keep {planLabel[entitlements.plan]} until then.
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
              entitlements.isPremium
                ? "Interview generations this month"
                : "Interview generations (form)"
            }
            used={entitlements.generationsUsed}
            limit={entitlements.generationsLimit}
          />
          {entitlements.callGenerationsLimit !== null && (
            <UsageMeter
              label="Hiring-manager call generations"
              used={entitlements.callGenerationsUsed}
              limit={entitlements.callGenerationsLimit}
            />
          )}
          <UsageMeter
            label={
              entitlements.isPremium
                ? "Practice sessions this month"
                : "Practice sessions"
            }
            used={entitlements.sessionsUsed}
            limit={entitlements.sessionsLimit}
          />
          {entitlements.isPremium && (
            <UsageMeter
              label="AI resume reviews this month"
              used={entitlements.resumeReviewsUsed}
              limit={entitlements.features.resumeReviewsPerMonth}
            />
          )}
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {entitlements.isPremium || subscription.hasSubscription ? (
            provider === "razorpay" ? (
              !subscription.cancelAtPeriodEnd && (
                <UpgradeButton
                  mode="manage"
                  className="btn-quiet flex-1"
                  confirmMessage="Cancel your renewal? You keep access until the end of the current billing period."
                >
                  Cancel renewal
                </UpgradeButton>
              )
            ) : (
              <UpgradeButton mode="manage" className="btn-quiet flex-1" />
            )
          ) : null}
          {isVapiByokEnabled() && (
            <Link href="/settings/vapi" className="btn-quiet flex-1">
              <KeyRound className="size-4" aria-hidden="true" />
              Use my own Vapi key
            </Link>
          )}
        </div>
      </div>

      {/* Plans — upgrade paths for everyone below Elite */}
      {entitlements.plan !== "elite" && entitlements.plan !== "byok" && (
        <div className="mt-10">
          <h2 className="display text-xl">Plans</h2>
          <p className="mt-1 text-sm text-faint">
            Upgrade for progress tracking, session replay, drills, and
            resume reviews.
          </p>
          <div className="mt-6">
            <PricingTiers
              currentPlan={entitlements.plan}
              currency={currency}
              trialEligible={!subscription.hasSubscription}
            />
          </div>
        </div>
      )}
    </div>
  );
}
