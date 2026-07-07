/**
 * lib/razorpay.ts
 *
 * Server-side Razorpay client (lazy singleton) + plan resolution for
 * every (tier, interval) combination.
 */

import Razorpay from "razorpay";
import {
  PLAN_PRICES,
  PLAN_LIMITS,
  type PaidPlan,
  type BillingInterval,
} from "@/lib/plans";
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

const PLAN_ENV_OVERRIDES: Record<PaidPlan, Record<BillingInterval, string>> = {
  pro: {
    monthly: "RAZORPAY_PRO_PLAN_ID",
    annual: "RAZORPAY_PRO_ANNUAL_PLAN_ID",
  },
  elite: {
    monthly: "RAZORPAY_ELITE_PLAN_ID",
    annual: "RAZORPAY_ELITE_ANNUAL_PLAN_ID",
  },
};

// Cache auto-created plans for the lifetime of the server process so we
// don't create a new Razorpay plan on every checkout.
const cachedPlanIds = new Map<string, string>();

/**
 * Resolve the Razorpay plan for a tier + billing interval: the env
 * override if set, otherwise create one once and log its ID so it can
 * be pinned in env.
 */
export async function getPlanId(
  plan: PaidPlan,
  interval: BillingInterval
): Promise<string> {
  const envVar = PLAN_ENV_OVERRIDES[plan][interval];
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;

  const cacheKey = `${plan}:${interval}`;
  const cached = cachedPlanIds.get(cacheKey);
  if (cached) return cached;

  const price = PLAN_PRICES[plan][interval].inr;
  const limits = PLAN_LIMITS[plan];
  const planName = plan === "elite" ? "Hired Fox Elite" : "Hired Fox Pro";

  const created = await getRazorpay().plans.create({
    period: interval === "annual" ? "yearly" : "monthly",
    interval: 1,
    item: {
      name: `${planName} (${interval})`,
      description: `${limits.generations} interview generations and ${limits.sessions} practice sessions (30 min each) per month`,
      amount: price * 100, // paise
      currency: "INR",
    },
  });

  cachedPlanIds.set(cacheKey, created.id);
  logger.info(
    `[Razorpay] Created ${cacheKey} plan ${created.id} — set ${envVar}=${created.id} in env to pin it`
  );
  return created.id;
}
