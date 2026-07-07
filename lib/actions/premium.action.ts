"use server";

import {
  getUserById,
  getFeedbackCountByUser,
  getUserSubscription,
  getUserCounts,
  countInterviewsCreatedSince,
  countFeedbacksCreatedSince,
  countCallGenerations,
} from "@/lib/db-queries";
import { hasUserVapiCredentials } from "@/lib/actions/vapi.action";
import {
  type Entitlements,
  FREE_CALL_GENERATIONS_TOTAL,
  FREE_SESSIONS_TOTAL,
  PRO_GENERATIONS_PER_PERIOD,
  PRO_SESSIONS_PER_PERIOD,
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
 * Whether the user has an active Pro subscription (or a legacy manual
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

/** Pro entitlements for a given usage snapshot */
function proEntitlements(
  generationsUsed: number,
  sessionsUsed: number,
  periodEnd: string | null,
  cancelAtPeriodEnd: boolean
): Entitlements {
  const canGenerate = generationsUsed < PRO_GENERATIONS_PER_PERIOD;
  return {
    plan: "pro",
    isPremium: true,
    canGenerateForm: canGenerate,
    canGenerateCall: canGenerate,
    canPractice: sessionsUsed < PRO_SESSIONS_PER_PERIOD,
    generationsUsed,
    generationsLimit: PRO_GENERATIONS_PER_PERIOD,
    callGenerationsUsed: 0,
    callGenerationsLimit: null, // calls count within the shared quota
    sessionsUsed,
    sessionsLimit: PRO_SESSIONS_PER_PERIOD,
    periodEnd,
    cancelAtPeriodEnd,
  };
}

/**
 * Single source of truth for what a user is allowed to do.
 *
 *  - byok:  own Vapi credentials — unlimited
 *  - pro:   10 generations (any method) + 10 practice sessions per period
 *  - free:  unlimited form generations, 1 hiring-manager call generation,
 *           1 practice session (lifetime)
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
    callGenerationsLimit: FREE_CALL_GENERATIONS_TOTAL,
    sessionsLimit: FREE_SESSIONS_TOTAL,
  };

  if (!userId) return lockedFree;

  try {
    const [hasByok, subscription] = await Promise.all([
      hasUserVapiCredentials(userId),
      getUserSubscription(userId),
    ]);

    // Own Vapi credentials: everything is on their own bill
    if (hasByok) {
      return unlimited;
    }

    const subscriptionActive =
      !!subscription &&
      (subscription.status === "active" ||
        subscription.status === "trialing") &&
      !!subscription.current_period_end &&
      subscription.current_period_end > new Date();

    if (subscriptionActive && subscription!.current_period_start) {
      const periodStart = subscription!.current_period_start;
      const [generationsUsed, sessionsUsed] = await Promise.all([
        countInterviewsCreatedSince(userId, periodStart),
        countFeedbacksCreatedSince(userId, periodStart),
      ]);

      return proEntitlements(
        generationsUsed,
        sessionsUsed,
        subscription!.current_period_end!.toISOString(),
        subscription!.cancel_at_period_end
      );
    }

    // Legacy manual premium flag (no subscription record): treat as pro
    // with usage measured over the last 30 days
    const user = await getUserById(userId);
    if (Boolean(user?.premium_user) && !subscription) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [generationsUsed, sessionsUsed] = await Promise.all([
        countInterviewsCreatedSince(userId, thirtyDaysAgo),
        countFeedbacksCreatedSince(userId, thirtyDaysAgo),
      ]);

      return proEntitlements(generationsUsed, sessionsUsed, null, false);
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
 * Subscription summary for the billing page
 */
export async function getSubscriptionSummary(userId: string): Promise<{
  hasSubscription: boolean;
  provider: string | null;
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
        status: null,
        periodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }
    return {
      hasSubscription: true,
      provider: subscription.provider,
      status: subscription.status,
      periodEnd: subscription.current_period_end?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
  } catch (error) {
    logger.error("Error fetching subscription summary:", error);
    return {
      hasSubscription: false,
      provider: null,
      status: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
}
