/**
 * lib/billing.ts
 *
 * Provider-agnostic subscription billing: dispatches checkout and
 * subscription management to Razorpay or Stripe based on configuration.
 * Supports Pro/Elite tiers, monthly/annual intervals, and a 7-day trial
 * for first-time subscribers.
 */

import { getPaymentProvider } from "@/lib/payments";
import { getStripe, getBaseUrl } from "@/lib/stripe";
import { getRazorpay, getPlanId } from "@/lib/razorpay";
import { getUserSubscription } from "@/lib/db-queries";
import {
  PLAN_PRICES,
  PLAN_LIMITS,
  TRIAL_DAYS,
  type PaidPlan,
  type BillingInterval,
} from "@/lib/plans";
import { logger } from "@/lib/logger";

export interface CheckoutResult {
  /** Redirect the browser here to pay */
  url: string;
  alreadySubscribed?: boolean;
}

export interface ManageResult {
  /** Redirect target (Stripe billing portal), if any */
  url?: string;
  /** Human-readable outcome when there is no redirect (Razorpay cancel) */
  message?: string;
}

function isSubscriptionActive(
  subscription: Awaited<ReturnType<typeof getUserSubscription>>
): boolean {
  return (
    !!subscription &&
    ["active", "trialing", "authenticated"].includes(subscription.status) &&
    !!subscription.current_period_end &&
    subscription.current_period_end > new Date()
  );
}

/**
 * Start a paid-plan checkout for the user.
 */
export async function createProCheckout(
  userId: string,
  email?: string,
  plan: PaidPlan = "pro",
  interval: BillingInterval = "monthly"
): Promise<CheckoutResult> {
  const provider = getPaymentProvider();
  const existing = await getUserSubscription(userId);

  // Trial only for first-time subscribers
  const eligibleForTrial = !existing;

  if (isSubscriptionActive(existing) && existing!.plan === plan) {
    const manage = await manageSubscription(userId);
    if (manage.url) return { url: manage.url, alreadySubscribed: true };
    throw new Error("You already have an active subscription on this plan.");
  }

  if (provider === "razorpay") {
    const razorpay = getRazorpay();
    const planId = await getPlanId(plan, interval);

    // Effectively "until canceled"
    const totalCount = interval === "annual" ? 10 : 120;

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: totalCount,
      customer_notify: 1,
      ...(eligibleForTrial
        ? {
            // Authorize now, first charge after the trial
            start_at: Math.floor(Date.now() / 1000) + TRIAL_DAYS * 24 * 60 * 60,
          }
        : {}),
      notes: { userId, email: email || "", plan, interval },
    });

    logger.info(`[Razorpay] Subscription created for user ${userId}`, {
      subscriptionId: subscription.id,
      plan,
      interval,
      trial: eligibleForTrial,
    });

    // short_url is Razorpay's hosted checkout page for this subscription
    const url = (subscription as { short_url?: string }).short_url;
    if (!url) {
      throw new Error("Razorpay did not return a checkout URL");
    }
    return { url };
  }

  // Stripe
  const stripe = getStripe();
  const baseUrl = getBaseUrl();
  const priceId =
    plan === "pro" && interval === "monthly"
      ? process.env.STRIPE_PRO_PRICE_ID
      : undefined;

  const price = PLAN_PRICES[plan][interval].usd;
  const limits = PLAN_LIMITS[plan];
  const planName = plan === "elite" ? "Hired Fox Elite" : "Hired Fox Pro";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: userId,
    ...(existing?.provider === "stripe" && existing.provider_customer_id
      ? { customer: existing.provider_customer_id }
      : { customer_email: email || undefined }),
    line_items: [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            price_data: {
              currency: "usd",
              unit_amount: price * 100,
              recurring: { interval: interval === "annual" ? "year" : "month" },
              product_data: {
                name: `${planName} (${interval})`,
                description: `${limits.generations} interview generations and ${limits.sessions} practice sessions (30 min each) per month`,
              },
            },
            quantity: 1,
          },
    ],
    subscription_data: {
      metadata: { userId, plan, interval },
      ...(eligibleForTrial ? { trial_period_days: TRIAL_DAYS } : {}),
    },
    metadata: { userId, plan, interval },
    success_url: `${baseUrl}/settings/billing?status=success`,
    cancel_url: `${baseUrl}/settings/billing?status=canceled`,
    allow_promotion_codes: true,
  });

  logger.info(`[Stripe] Checkout session created for user ${userId}`, {
    sessionId: session.id,
    plan,
    interval,
    trial: eligibleForTrial,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url };
}

/**
 * Manage an existing subscription: Stripe opens the billing portal;
 * Razorpay (no portal) schedules cancellation at the end of the period.
 */
export async function manageSubscription(userId: string): Promise<ManageResult> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    throw new Error("No subscription found for this account");
  }

  if (subscription.provider === "razorpay") {
    if (subscription.cancel_at_period_end) {
      return {
        message:
          "Your subscription is already set to cancel at the end of the current period.",
      };
    }

    // cancel_at_cycle_end keeps access until the paid period runs out
    await getRazorpay().subscriptions.cancel(
      subscription.provider_subscription_id,
      true
    );

    logger.info(`[Razorpay] Cancellation scheduled for user ${userId}`, {
      subscriptionId: subscription.provider_subscription_id,
    });

    return {
      message:
        "Renewal canceled. You keep access until the end of the current billing period.",
    };
  }

  // Stripe billing portal
  const portal = await getStripe().billingPortal.sessions.create({
    customer: subscription.provider_customer_id,
    return_url: `${getBaseUrl()}/settings/billing`,
  });

  return { url: portal.url };
}
