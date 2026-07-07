/**
 * lib/billing.ts
 *
 * Provider-agnostic subscription billing: dispatches checkout and
 * subscription management to Razorpay or Stripe based on configuration.
 */

import { getPaymentProvider } from "@/lib/payments";
import { getStripe, getBaseUrl } from "@/lib/stripe";
import { getRazorpay, getProPlanId } from "@/lib/razorpay";
import { getUserSubscription } from "@/lib/db-queries";
import { PRO_PRICE_USD } from "@/lib/plans";
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
 * Start a Pro subscription checkout for the user.
 */
export async function createProCheckout(
  userId: string,
  email?: string
): Promise<CheckoutResult> {
  const provider = getPaymentProvider();
  const existing = await getUserSubscription(userId);

  if (isSubscriptionActive(existing)) {
    const manage = await manageSubscription(userId);
    if (manage.url) return { url: manage.url, alreadySubscribed: true };
    throw new Error("You already have an active subscription.");
  }

  if (provider === "razorpay") {
    const razorpay = getRazorpay();
    const planId = await getProPlanId();

    // 120 monthly charges = effectively "until canceled"
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 120,
      customer_notify: 1,
      notes: { userId, email: email || "" },
    });

    logger.info(`[Razorpay] Subscription created for user ${userId}`, {
      subscriptionId: subscription.id,
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
  const priceId = process.env.STRIPE_PRO_PRICE_ID;

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
              unit_amount: PRO_PRICE_USD * 100,
              recurring: { interval: "month" },
              product_data: {
                name: "Hired Fox Pro",
                description:
                  "10 interview generations and 10 practice sessions (30 min each) per month",
              },
            },
            quantity: 1,
          },
    ],
    subscription_data: { metadata: { userId } },
    metadata: { userId },
    success_url: `${baseUrl}/settings/billing?status=success`,
    cancel_url: `${baseUrl}/settings/billing?status=canceled`,
    allow_promotion_codes: true,
  });

  logger.info(`[Stripe] Checkout session created for user ${userId}`, {
    sessionId: session.id,
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

    // cancel_at_cycle_end keeps Pro until the paid period runs out
    await getRazorpay().subscriptions.cancel(
      subscription.provider_subscription_id,
      true
    );

    logger.info(`[Razorpay] Cancellation scheduled for user ${userId}`, {
      subscriptionId: subscription.provider_subscription_id,
    });

    return {
      message:
        "Renewal canceled. You keep Pro access until the end of the current billing period.",
    };
  }

  // Stripe billing portal
  const portal = await getStripe().billingPortal.sessions.create({
    customer: subscription.provider_customer_id,
    return_url: `${getBaseUrl()}/settings/billing`,
  });

  return { url: portal.url };
}
