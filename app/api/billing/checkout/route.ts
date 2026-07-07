/**
 * app/api/billing/checkout/route.ts
 *
 * Provider-agnostic Pro checkout (Razorpay or Stripe).
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { createProCheckout } from "@/lib/billing";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const result = await createProCheckout(
      userId,
      user?.emailAddresses?.[0]?.emailAddress
    );

    return Response.json(result);
  } catch (error: any) {
    logger.error("[Billing] Error creating checkout:", error);
    return Response.json(
      { error: error.message || "Failed to start checkout" },
      { status: 500 }
    );
  }
}
