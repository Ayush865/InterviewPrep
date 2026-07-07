/**
 * lib/razorpay.ts
 *
 * Server-side Razorpay client (lazy singleton) + Pro plan resolution.
 */

import Razorpay from "razorpay";
import { PRO_PRICE_INR, PRO_SESSIONS_PER_PERIOD, PRO_GENERATIONS_PER_PERIOD } from "@/lib/plans";
import { logger } from "@/lib/logger";

let razorpayClient: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!razorpayClient) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured");
    }
    razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpayClient;
}

// Cache the auto-created plan for the lifetime of the server process so
// we don't create a new Razorpay plan on every checkout.
let cachedPlanId: string | null = null;

/**
 * Resolve the ₹425/month Pro plan: RAZORPAY_PRO_PLAN_ID if set,
 * otherwise create one once and log its ID so it can be pinned in env.
 */
export async function getProPlanId(): Promise<string> {
  if (process.env.RAZORPAY_PRO_PLAN_ID) {
    return process.env.RAZORPAY_PRO_PLAN_ID;
  }
  if (cachedPlanId) return cachedPlanId;

  const plan = await getRazorpay().plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: "Hired Fox Pro",
      description: `${PRO_GENERATIONS_PER_PERIOD} interview generations and ${PRO_SESSIONS_PER_PERIOD} practice sessions (30 min each) per month`,
      amount: PRO_PRICE_INR * 100, // paise
      currency: "INR",
    },
  });

  cachedPlanId = plan.id;
  logger.info(
    `[Razorpay] Created Pro plan ${plan.id} — set RAZORPAY_PRO_PLAN_ID=${plan.id} in env to pin it`
  );
  return plan.id;
}
