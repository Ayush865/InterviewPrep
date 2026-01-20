"use server";

import { getUserById } from "@/lib/db-queries";
import { getFeedbackCountByUser } from "@/lib/db-queries";
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
 * Get user's premium status from MySQL
 */
export async function getUserPremiumStatus(userId: string): Promise<boolean> {
  try {
    const user = await getUserById(userId);
    // MySQL returns 1/0 for boolean columns, use Boolean() to handle both cases
    return Boolean(user?.premium_user);
  } catch (error) {
    logger.error("Error fetching user premium status:", error);
    return false;
  }
}
