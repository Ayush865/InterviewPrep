/**
 * app/api/stripe/portal/route.ts
 *
 * Opens the Stripe Billing Portal so subscribers can manage or cancel.
 */

import { auth } from "@clerk/nextjs/server";
import { getStripe, getBaseUrl } from "@/lib/stripe";
import { getUserSubscription } from "@/lib/db-queries";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await getUserSubscription(userId);
    if (!subscription?.stripe_customer_id) {
      return Response.json(
        { error: "No subscription found for this account" },
        { status: 404 }
      );
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${getBaseUrl()}/settings/billing`,
    });

    return Response.json({ url: session.url });
  } catch (error: any) {
    logger.error("[Stripe] Error creating portal session:", error);
    return Response.json(
      { error: error.message || "Failed to open billing portal" },
      { status: 500 }
    );
  }
}
