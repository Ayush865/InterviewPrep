"use server";

import {
  getUserById,
  getFeedbackCountByUser,
  getUserSubscription,
  getUserCounts,
  countInterviewsCreatedSince,
  countFeedbacksCreatedSince,
  countCallGenerations,
  countResumeReviewsSince,
} from "@/lib/db-queries";
import { hasUserVapiCredentials } from "@/lib/actions/vapi.action";
import {
  type Entitlements,
  type PaidPlan,
  PLAN_FEATURES,
  PLAN_LIMITS,
  FREE_CALL_GENERATIONS_TOTAL,
  FREE_SESSIONS_TOTAL,
  usageWindowStart,
} from "@/lib/plans";
import { logger } from "@/lib/logger";

/**
 * Get user's feedback count from MySQL
 */
export async function getUserFeedbackCount(userId: string): Promise<number> {
  try {
    return await getFeedbackCountByUser(userId);
  } catch (error) {
    logger.error("Error fetching user feedback count:", error);
    return 0;
  }
}

/**
 * Whether the user has an active paid subscription (or a legacy manual
 * premium flag). Subscription expiry is checked against the DB record,
 * which the payment-provider webhook keeps in sync.
 */
export async function getUserPremiumStatus(userId: string): Promise<boolean> {
  try {
    const subscription = await getUserSubscription(userId);
    if (subscription) {
      const active =
        (subscription.status === "active" ||
          subscription.status === "trialing") &&
        !!subscription.current_period_end &&
        subscription.current_period_end > new Date();
      return active;
    }

    // Legacy: manually flagged premium users without a subscription record
    const user = await getUserById(userId);
    return Boolean(user?.premium_user);
  } catch (error) {
    logger.error("Error fetching user premium status:", error);
    return false;
  }
}

/** Paid-plan entitlements for a given usage snapshot */
function paidEntitlements(
  plan: PaidPlan,
  usage: {
    generationsUsed: number;
    sessionsUsed: number;
    resumeReviewsUsed: number;
  },
  periodEnd: string | null,
  cancelAtPeriodEnd: boolean
): Entitlements {
  const limits = PLAN_LIMITS[plan];
  const canGenerate = usage.generationsUsed < limits.generations;

  return {
    plan,
    isPremium: true,
    canGenerateForm: canGenerate,
    canGenerateCall: canGenerate,
    canPractice: usage.sessionsUsed < limits.sessions,
    features: PLAN_FEATURES[plan],
    resumeReviewsUsed: usage.resumeReviewsUsed,
    generationsUsed: usage.generationsUsed,
    generationsLimit: limits.generations,
    callGenerationsUsed: 0,
    callGenerationsLimit: null, // calls count within the shared quota
    sessionsUsed: usage.sessionsUsed,
    sessionsLimit: limits.sessions,
    periodEnd,
    cancelAtPeriodEnd,
  };
}

/**
 * Single source of truth for what a user is allowed to do.
 *
 *  - byok:  own Vapi credentials — unlimited usage, Pro-level features
 *  - elite: 30 generations + 30 sessions per monthly window, unlimited
 *           resume reviews
 *  - pro:   10 generations + 10 sessions per monthly window, 1 resume
 *           review per month
 *  - free:  unlimited form generations, 1 call generation, 1 practice
 *           session (lifetime); no premium features
 *
 * Annual subscriptions bill yearly but quotas reset on the monthly
 * anniversary of the billing period start (see usageWindowStart).
 */
export async function getUserEntitlements(
  userId: string
): Promise<Entitlements> {
  const unlimited: Entitlements = {
    plan: "byok",
    isPremium: false,
    canGenerateForm: true,
    canGenerateCall: true,
    canPractice: true,
    features: PLAN_FEATURES.byok,
    resumeReviewsUsed: 0,
    generationsUsed: 0,
    generationsLimit: null,
    callGenerationsUsed: 0,
    callGenerationsLimit: null,
    sessionsUsed: 0,
    sessionsLimit: null,
    periodEnd: null,
    cancelAtPeriodEnd: false,
  };

  const lockedFree: Entitlements = {
    ...unlimited,
    plan: "free",
    canGenerateForm: false,
    canGenerateCall: false,
    canPractice: false,
    features: PLAN_FEATURES.free,
    callGenerationsLimit: FREE_CALL_GENERATIONS_TOTAL,
    sessionsLimit: FREE_SESSIONS_TOTAL,
  };

  if (!userId) return lockedFree;

  try {
    const [hasByok, subscription] = await Promise.all([
      hasUserVapiCredentials(userId),
      getUserSubscription(userId),
    ]);

    // Own Vapi credentials: usage is on their own bill
    if (hasByok) {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const resumeReviewsUsed = await countResumeReviewsSince(userId, monthAgo);
      return { ...unlimited, resumeReviewsUsed };
    }

    const subscriptionActive =
      !!subscription &&
      (subscription.status === "active" ||
        subscription.status === "trialing") &&
      !!subscription.current_period_end &&
      subscription.current_period_end > new Date();

    if (subscriptionActive && subscription!.current_period_start) {
      const plan: PaidPlan =
        subscription!.plan === "elite" ? "elite" : "pro";
      // Monthly usage window (handles annual billing periods too)
      const windowStart = usageWindowStart(
        subscription!.current_period_start
      );

      const [generationsUsed, sessionsUsed, resumeReviewsUsed] =
        await Promise.all([
          countInterviewsCreatedSince(userId, windowStart),
          countFeedbacksCreatedSince(userId, windowStart),
          countResumeReviewsSince(userId, windowStart),
        ]);

      return paidEntitlements(
        plan,
        { generationsUsed, sessionsUsed, resumeReviewsUsed },
        subscription!.current_period_end!.toISOString(),
        subscription!.cancel_at_period_end
      );
    }

    // Legacy manual premium flag (no subscription record): treat as pro
    // with usage measured over the last 30 days
    const user = await getUserById(userId);
    if (Boolean(user?.premium_user) && !subscription) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [generationsUsed, sessionsUsed, resumeReviewsUsed] =
        await Promise.all([
          countInterviewsCreatedSince(userId, thirtyDaysAgo),
          countFeedbacksCreatedSince(userId, thirtyDaysAgo),
          countResumeReviewsSince(userId, thirtyDaysAgo),
        ]);

      return paidEntitlements(
        "pro",
        { generationsUsed, sessionsUsed, resumeReviewsUsed },
        null,
        false
      );
    }

    // Free plan: form generation is unlimited; the hiring-manager call
    // and practice sessions are limited (lifetime)
    const [counts, callGenerationsUsed] = await Promise.all([
      getUserCounts(userId),
      countCallGenerations(userId),
    ]);

    return {
      plan: "free",
      isPremium: false,
      canGenerateForm: true,
      canGenerateCall: callGenerationsUsed < FREE_CALL_GENERATIONS_TOTAL,
      canPractice: counts.feedbackCount < FREE_SESSIONS_TOTAL,
      features: PLAN_FEATURES.free,
      resumeReviewsUsed: 0,
      generationsUsed: counts.interviewCount,
      generationsLimit: null, // form generation is unlimited
      callGenerationsUsed,
      callGenerationsLimit: FREE_CALL_GENERATIONS_TOTAL,
      sessionsUsed: counts.feedbackCount,
      sessionsLimit: FREE_SESSIONS_TOTAL,
      periodEnd: null,
      cancelAtPeriodEnd: false,
    };
  } catch (error) {
    logger.error(`Error computing entitlements for ${userId}:`, error);
    // Fail closed
    return lockedFree;
  }
}

/**
 * Whether the user can run a resume review right now, based on plan
 * feature limits and this month's usage.
 */
export async function canUseResumeReview(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number | null;
  plan: Entitlements["plan"];
}> {
  const entitlements = await getUserEntitlements(userId);
  const limit = entitlements.features.resumeReviewsPerMonth;

  if (limit === null) {
    return { allowed: true, used: entitlements.resumeReviewsUsed, limit, plan: entitlements.plan };
  }
  return {
    allowed: entitlements.resumeReviewsUsed < limit,
    used: entitlements.resumeReviewsUsed,
    limit,
    plan: entitlements.plan,
  };
}

/**
 * Subscription summary for the billing page
 */
export async function getSubscriptionSummary(userId: string): Promise<{
  hasSubscription: boolean;
  provider: string | null;
  plan: string | null;
  status: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}> {
  try {
    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      return {
        hasSubscription: false,
        provider: null,
        plan: null,
        status: null,
        periodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }
    return {
      hasSubscription: true,
      provider: subscription.provider,
      plan: subscription.plan,
      status: subscription.status,
      periodEnd: subscription.current_period_end?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
  } catch (error) {
    logger.error("Error fetching subscription summary:", error);
    return {
      hasSubscription: false,
      provider: null,
      plan: null,
      status: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
}
