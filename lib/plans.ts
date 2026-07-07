/**
 * lib/plans.ts
 *
 * Plan definitions and limits — safe to import from client and server.
 *
 *  - free: 1 interview generation and 1 practice session, total
 *  - pro ($5/month): 10 generations + 10 practice sessions per billing
 *    period, sessions capped at 30 minutes
 *  - byok: user connected their own Vapi credentials — unlimited,
 *    billed to their Vapi account
 */

export type Plan = "free" | "pro" | "byok";

export const PRO_PRICE_USD = 5;
/** Razorpay charges in INR — ~$5 equivalent */
export const PRO_PRICE_INR = 425;

export const FREE_GENERATIONS_TOTAL = 1;
export const FREE_SESSIONS_TOTAL = 1;

export const PRO_GENERATIONS_PER_PERIOD = 10;
export const PRO_SESSIONS_PER_PERIOD = 10;

/** Max practice-call length for free/pro users (BYOK is uncapped) */
export const SESSION_MAX_DURATION_SECONDS = 30 * 60;

export interface Entitlements {
  plan: Plan;
  /** Active pro subscription (status active/trialing and not expired) */
  isPremium: boolean;
  canGenerate: boolean;
  canPractice: boolean;
  generationsUsed: number;
  /** null = unlimited */
  generationsLimit: number | null;
  sessionsUsed: number;
  /** null = unlimited */
  sessionsLimit: number | null;
  /** ISO date the current billing period ends (pro only) */
  periodEnd: string | null;
  /** Subscription will not renew after periodEnd */
  cancelAtPeriodEnd: boolean;
}
