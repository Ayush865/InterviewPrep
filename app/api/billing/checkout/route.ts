/**
 * app/api/billing/checkout/route.ts
 *
 * Provider-agnostic Pro checkout (Razorpay or Stripe).
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { createProCheckout } from "@/lib/billing";
import type { PaidPlan, BillingInterval } from "@/lib/plans";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let plan: PaidPlan = "pro";
    let interval: BillingInterval = "monthly";
    try {
      const body = await request.json();
      if (body.plan === "elite") plan = "elite";
      if (body.interval === "annual") interval = "annual";
    } catch {
      // No body — default to pro/monthly
    }

    const user = await currentUser();
    const result = await createProCheckout(
      userId,
      user?.emailAddresses?.[0]?.emailAddress,
      plan,
      interval
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
