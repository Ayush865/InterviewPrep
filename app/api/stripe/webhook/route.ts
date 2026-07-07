/**
 * app/api/stripe/webhook/route.ts
 *
 * Stripe webhook — keeps user_subscriptions and users.premium_user in
 * sync with Stripe. Configure the endpoint in the Stripe dashboard with
 * events: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted, invoice.payment_failed.
 */

import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  upsertUserSubscription,
  getSubscriptionByProviderId,
} from "@/lib/db-queries";
import { logger } from "@/lib/logger";

/**
 * Billing period fields moved from the subscription to its items in
 * newer Stripe API versions — read both shapes.
 */
function getPeriod(subscription: Stripe.Subscription): {
  start: Date | null;
  end: Date | null;
} {
  const item = subscription.items?.data?.[0] as
    | (Stripe.SubscriptionItem & {
        current_period_start?: number;
        current_period_end?: number;
      })
    | undefined;

  const legacy = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };

  const start = item?.current_period_start ?? legacy.current_period_start;
  const end = item?.current_period_end ?? legacy.current_period_end;

  return {
    start: start ? new Date(start * 1000) : null,
    end: end ? new Date(end * 1000) : null,
  };
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  fallbackUserId?: string
) {
  const userId =
    subscription.metadata?.userId ||
    fallbackUserId ||
    (await getSubscriptionByProviderId(subscription.id))?.user_id;

  if (!userId) {
    logger.error(
      `[Stripe] Cannot sync subscription ${subscription.id}: no userId in metadata or DB`
    );
    return;
  }

  const period = getPeriod(subscription);

  await upsertUserSubscription({
    user_id: userId,
    provider: "stripe",
    provider_customer_id:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    provider_subscription_id: subscription.id,
    status: subscription.status,
    plan: "pro",
    current_period_start: period.start,
    current_period_end: period.end,
    cancel_at_period_end: subscription.cancel_at_period_end,
  });

  logger.info(`[Stripe] Synced subscription for user ${userId}`, {
    subscriptionId: subscription.id,
    status: subscription.status,
    periodEnd: period.end?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("[Stripe] STRIPE_WEBHOOK_SECRET is not configured");
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  } catch (error: any) {
    logger.error("[Stripe] Webhook signature verification failed:", error);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  logger.info(`[Stripe] Webhook received: ${event.type}`, { id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id
          );
          await syncSubscription(
            subscription,
            session.client_reference_id ||
              session.metadata?.userId ||
              undefined
          );
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logger.warn(`[Stripe] Payment failed`, {
          customer: invoice.customer,
          invoiceId: invoice.id,
        });
        // Status transition (past_due/unpaid) arrives via
        // customer.subscription.updated — nothing else to do here.
        break;
      }

      default:
        logger.debug(`[Stripe] Ignoring event type ${event.type}`);
    }

    return Response.json({ received: true });
  } catch (error: any) {
    logger.error(`[Stripe] Error handling webhook ${event.type}:`, error);
    // Non-2xx so Stripe retries
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
