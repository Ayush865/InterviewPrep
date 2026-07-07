/**
 * app/api/stripe/checkout/route.ts
 *
 * Creates a Stripe Checkout session for the $5/month Pro subscription.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { getStripe, getBaseUrl } from "@/lib/stripe";
import { getUserSubscription } from "@/lib/db-queries";
import { PRO_PRICE_USD } from "@/lib/plans";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const stripe = getStripe();
    const baseUrl = getBaseUrl();

    // Reuse the Stripe customer if the user subscribed before
    const existing = await getUserSubscription(userId);

    // Already on an active subscription — send them to the portal instead
    if (
      existing &&
      (existing.status === "active" || existing.status === "trialing") &&
      existing.current_period_end &&
      existing.current_period_end > new Date()
    ) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: existing.stripe_customer_id,
        return_url: `${baseUrl}/settings/billing`,
      });
      return Response.json({ url: portal.url, alreadySubscribed: true });
    }

    const priceId = process.env.STRIPE_PRO_PRICE_ID;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: userId,
      ...(existing?.stripe_customer_id
        ? { customer: existing.stripe_customer_id }
        : {
            customer_email:
              user?.emailAddresses?.[0]?.emailAddress || undefined,
          }),
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
      subscription_data: {
        metadata: { userId },
      },
      metadata: { userId },
      success_url: `${baseUrl}/settings/billing?status=success`,
      cancel_url: `${baseUrl}/settings/billing?status=canceled`,
      allow_promotion_codes: true,
    });

    logger.info(`[Stripe] Checkout session created for user ${userId}`, {
      sessionId: session.id,
    });

    return Response.json({ url: session.url });
  } catch (error: any) {
    logger.error("[Stripe] Error creating checkout session:", error);
    return Response.json(
      { error: error.message || "Failed to start checkout" },
      { status: 500 }
    );
  }
}
