"use server";

import {
  getUserById,
  getFeedbackCountByUser,
  getUserSubscription,
  getUserCounts,
  countInterviewsCreatedSince,
  countFeedbacksCreatedSince,
} from "@/lib/db-queries";
import { hasUserVapiCredentials } from "@/lib/actions/vapi.action";
import {
  type Entitlements,
  FREE_GENERATIONS_TOTAL,
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
 * which the Stripe webhook keeps in sync.
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

    // Legacy: manually flagged premium users without a Stripe record
    const user = await getUserById(userId);
    return Boolean(user?.premium_user);
  } catch (error) {
    logger.error("Error fetching user premium status:", error);
    return false;
  }
}

/**
 * Single source of truth for what a user is allowed to do.
 *
 *  - byok:  own Vapi credentials — unlimited
 *  - pro:   10 generations + 10 practice sessions per billing period
 *  - free:  1 generation + 1 practice session, total
 */
export async function getUserEntitlements(
  userId: string
): Promise<Entitlements> {
  const unlimited: Entitlements = {
    plan: "byok",
    isPremium: false,
    canGenerate: true,
    canPractice: true,
    generationsUsed: 0,
    generationsLimit: null,
    sessionsUsed: 0,
    sessionsLimit: null,
    periodEnd: null,
    cancelAtPeriodEnd: false,
  };

  if (!userId) {
    return {
      ...unlimited,
      plan: "free",
      canGenerate: false,
      canPractice: false,
      generationsLimit: FREE_GENERATIONS_TOTAL,
      sessionsLimit: FREE_SESSIONS_TOTAL,
    };
  }

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

      return {
        plan: "pro",
        isPremium: true,
        canGenerate: generationsUsed < PRO_GENERATIONS_PER_PERIOD,
        canPractice: sessionsUsed < PRO_SESSIONS_PER_PERIOD,
        generationsUsed,
        generationsLimit: PRO_GENERATIONS_PER_PERIOD,
        sessionsUsed,
        sessionsLimit: PRO_SESSIONS_PER_PERIOD,
        periodEnd: subscription!.current_period_end!.toISOString(),
        cancelAtPeriodEnd: subscription!.cancel_at_period_end,
      };
    }

    // Legacy manual premium flag (no Stripe record): treat as pro with
    // usage measured over the last 30 days
    const user = await getUserById(userId);
    if (Boolean(user?.premium_user) && !subscription) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [generationsUsed, sessionsUsed] = await Promise.all([
        countInterviewsCreatedSince(userId, thirtyDaysAgo),
        countFeedbacksCreatedSince(userId, thirtyDaysAgo),
      ]);

      return {
        plan: "pro",
        isPremium: true,
        canGenerate: generationsUsed < PRO_GENERATIONS_PER_PERIOD,
        canPractice: sessionsUsed < PRO_SESSIONS_PER_PERIOD,
        generationsUsed,
        generationsLimit: PRO_GENERATIONS_PER_PERIOD,
        sessionsUsed,
        sessionsLimit: PRO_SESSIONS_PER_PERIOD,
        periodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    // Free plan: lifetime totals
    const counts = await getUserCounts(userId);

    return {
      plan: "free",
      isPremium: false,
      canGenerate: counts.interviewCount < FREE_GENERATIONS_TOTAL,
      canPractice: counts.feedbackCount < FREE_SESSIONS_TOTAL,
      generationsUsed: counts.interviewCount,
      generationsLimit: FREE_GENERATIONS_TOTAL,
      sessionsUsed: counts.feedbackCount,
      sessionsLimit: FREE_SESSIONS_TOTAL,
      periodEnd: null,
      cancelAtPeriodEnd: false,
    };
  } catch (error) {
    logger.error(`Error computing entitlements for ${userId}:`, error);
    // Fail closed for paid features, but don't block existing free usage checks
    return {
      plan: "free",
      isPremium: false,
      canGenerate: false,
      canPractice: false,
      generationsUsed: 0,
      generationsLimit: FREE_GENERATIONS_TOTAL,
      sessionsUsed: 0,
      sessionsLimit: FREE_SESSIONS_TOTAL,
      periodEnd: null,
      cancelAtPeriodEnd: false,
    };
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
