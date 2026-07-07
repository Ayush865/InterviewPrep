/**
 * app/api/razorpay/webhook/route.ts
 *
 * Razorpay webhook — keeps user_subscriptions and users.premium_user in
 * sync. Configure in the Razorpay dashboard (Settings → Webhooks) with
 * events: subscription.activated, subscription.charged,
 * subscription.pending, subscription.halted, subscription.cancelled,
 * subscription.completed, subscription.updated.
 */

import crypto from "crypto";
import {
  upsertUserSubscription,
  getSubscriptionByProviderId,
} from "@/lib/db-queries";
import { logger } from "@/lib/logger";

interface RazorpaySubscriptionEntity {
  id: string;
  plan_id: string;
  customer_id: string | null;
  status: string; // created | authenticated | active | pending | halted | cancelled | completed | expired
  current_start: number | null;
  current_end: number | null;
  charge_at: number | null;
  end_at: number | null;
  notes: Record<string, string> | string[];
}

/** Map Razorpay subscription statuses onto our normalized set */
function normalizeStatus(status: string): string {
  switch (status) {
    case "active":
    case "authenticated":
      return "active";
    case "pending":
    case "halted":
      return "past_due";
    case "cancelled":
    case "completed":
    case "expired":
      return "canceled";
    default:
      return status; // created, paused, ...
  }
}

async function syncSubscription(entity: RazorpaySubscriptionEntity) {
  const notes = Array.isArray(entity.notes) ? {} : entity.notes || {};
  const userId =
    notes.userId || (await getSubscriptionByProviderId(entity.id))?.user_id;

  if (!userId) {
    logger.error(
      `[Razorpay] Cannot sync subscription ${entity.id}: no userId in notes or DB`
    );
    return;
  }

  const status = normalizeStatus(entity.status);
  // While a cancelled subscription still has time left, keep the paid
  // period end so access survives until expiry
  const periodEnd = entity.current_end ?? entity.end_at;

  await upsertUserSubscription({
    user_id: userId,
    provider: "razorpay",
    provider_customer_id: entity.customer_id || "",
    provider_subscription_id: entity.id,
    status:
      status === "canceled" && periodEnd && periodEnd * 1000 > Date.now()
        ? "active" // paid through period end; webhook fires again on expiry
        : status,
    plan: notes.plan === "elite" ? "elite" : "pro",
    current_period_start: entity.current_start
      ? new Date(entity.current_start * 1000)
      : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000) : null,
    cancel_at_period_end: entity.status === "cancelled",
  });

  logger.info(`[Razorpay] Synced subscription for user ${userId}`, {
    subscriptionId: entity.id,
    rawStatus: entity.status,
    periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("[Razorpay] RAZORPAY_WEBHOOK_SECRET is not configured");
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");

  const valid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) {
    logger.error("[Razorpay] Webhook signature verification failed");
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: {
    event: string;
    payload?: { subscription?: { entity?: RazorpaySubscriptionEntity } };
  };
  try {
    event = JSON.parse(payload);
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  logger.info(`[Razorpay] Webhook received: ${event.event}`);

  try {
    if (event.event.startsWith("subscription.")) {
      const entity = event.payload?.subscription?.entity;
      if (entity) {
        await syncSubscription(entity);
      } else {
        logger.warn(`[Razorpay] ${event.event} without subscription entity`);
      }
    } else {
      logger.debug(`[Razorpay] Ignoring event type ${event.event}`);
    }

    return Response.json({ received: true });
  } catch (error: any) {
    logger.error(`[Razorpay] Error handling webhook ${event.event}:`, error);
    // Non-2xx so Razorpay retries
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
