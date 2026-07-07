/**
 * app/api/billing/manage/route.ts
 *
 * Manage an existing subscription: Stripe returns a billing-portal URL,
 * Razorpay schedules cancellation at the end of the current period.
 */

import { auth } from "@clerk/nextjs/server";
import { manageSubscription } from "@/lib/billing";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await manageSubscription(userId);
    return Response.json(result);
  } catch (error: any) {
    logger.error("[Billing] Error managing subscription:", error);
    return Response.json(
      { error: error.message || "Failed to manage subscription" },
      { status: 500 }
    );
  }
}
