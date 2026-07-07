/**
 * lib/plans.ts
 *
 * Plan definitions and limits — safe to import from client and server.
 *
 *  - free:  unlimited form generations, 1 hiring-manager call generation,
 *           1 practice session (total). Score + basic feedback only.
 *  - pro:   10 generations + 10 practice sessions per month. Unlocks
 *           progress dashboard, session replay, targeted drills,
 *           JD-based interviews, and 1 resume review per month.
 *  - elite: 30 generations + 30 practice sessions per month, unlimited
 *           resume reviews.
 *  - byok:  own Vapi credentials — unlimited usage, Pro-level features.
 *
 * Annual plans bill yearly but usage quotas reset on monthly windows
 * anchored to the subscription start.
 */

export type Plan = "free" | "pro" | "elite" | "byok";
export type PaidPlan = "pro" | "elite";
export type BillingInterval = "monthly" | "annual";

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

export const PLAN_PRICES = {
  pro: {
    monthly: { usd: 5, inr: 425 },
    annual: { usd: 36, inr: 2999 }, // ~40% off
  },
  elite: {
    monthly: { usd: 18, inr: 1499 },
    annual: { usd: 129, inr: 9999 },
  },
} as const;

/** Trial period for new subscribers */
export const TRIAL_DAYS = 7;

// Backwards-compatible aliases (used across billing UI/copy)
export const PRO_PRICE_USD = PLAN_PRICES.pro.monthly.usd;
export const PRO_PRICE_INR = PLAN_PRICES.pro.monthly.inr;

// ---------------------------------------------------------------------------
// Usage limits
// ---------------------------------------------------------------------------

/** Free plan: hiring-manager call generations (form is unlimited) */
export const FREE_CALL_GENERATIONS_TOTAL = 1;
export const FREE_SESSIONS_TOTAL = 1;

export const PLAN_LIMITS = {
  pro: { generations: 10, sessions: 10, resumeReviews: 1 },
  elite: { generations: 30, sessions: 30, resumeReviews: null }, // null = unlimited
} as const;

// Backwards-compatible aliases
export const PRO_GENERATIONS_PER_PERIOD = PLAN_LIMITS.pro.generations;
export const PRO_SESSIONS_PER_PERIOD = PLAN_LIMITS.pro.sessions;

/** Max practice-call length for free/pro/elite (BYOK is uncapped) */
export const SESSION_MAX_DURATION_SECONDS = 30 * 60;

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------

export interface PlanFeatures {
  /** Progress dashboard + score history */
  progress: boolean;
  /** Session transcript replay */
  replay: boolean;
  /** Targeted drills from weak categories */
  drills: boolean;
  /** Job-description-based interview generation */
  jdInterviews: boolean;
  /** Resume reviews allowed per month (0 = none, null = unlimited) */
  resumeReviewsPerMonth: number | null;
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    progress: false,
    replay: false,
    drills: false,
    jdInterviews: false,
    resumeReviewsPerMonth: 0,
  },
  pro: {
    progress: true,
    replay: true,
    drills: true,
    jdInterviews: true,
    resumeReviewsPerMonth: PLAN_LIMITS.pro.resumeReviews,
  },
  elite: {
    progress: true,
    replay: true,
    drills: true,
    jdInterviews: true,
    resumeReviewsPerMonth: PLAN_LIMITS.elite.resumeReviews,
  },
  byok: {
    progress: true,
    replay: true,
    drills: true,
    jdInterviews: true,
    resumeReviewsPerMonth: 1,
  },
};

export interface Entitlements {
  plan: Plan;
  /** Active paid subscription (status active/trialing and not expired) */
  isPremium: boolean;
  /** Generate via the form */
  canGenerateForm: boolean;
  /** Generate via the hiring-manager call */
  canGenerateCall: boolean;
  canPractice: boolean;
  features: PlanFeatures;
  /** Resume reviews used in the current monthly window */
  resumeReviewsUsed: number;
  /** Generations counted against the plan quota (paid: per window) */
  generationsUsed: number;
  /** null = unlimited */
  generationsLimit: number | null;
  /** Call generations (free plan tracks these separately) */
  callGenerationsUsed: number;
  /** null = not separately limited (paid/byok) */
  callGenerationsLimit: number | null;
  sessionsUsed: number;
  /** null = unlimited */
  sessionsLimit: number | null;
  /** ISO date the current billing period ends (paid only) */
  periodEnd: string | null;
  /** Subscription will not renew after periodEnd */
  cancelAtPeriodEnd: boolean;
}

/**
 * Usage windows: monthly plans use the billing period directly; annual
 * plans reset quotas on the monthly anniversary of the period start.
 * Returns the start of the current usage window.
 */
export function usageWindowStart(periodStart: Date, now = new Date()): Date {
  const window = new Date(periodStart);
  // Advance month by month until the next step would pass "now"
  while (true) {
    const next = new Date(window);
    next.setMonth(next.getMonth() + 1);
    if (next > now) break;
    window.setMonth(window.getMonth() + 1);
  }
  return window;
}
