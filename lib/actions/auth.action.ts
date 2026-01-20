"use server";

import { auth } from "@clerk/nextjs/server";
import { getUserById, createUser, getUserByEmail } from "@/lib/db-queries";
import { logger } from "@/lib/logger";

/**
 * Sign up a new user (called after Clerk creates the user)
 * This syncs the Clerk user to our MySQL database
 */
export async function signUp(params: SignUpParams) {
  const { uid, name, email } = params;

  try {
    // Check if user exists in MySQL
    const existingUser = await getUserById(uid);
    if (existingUser) {
      return {
        success: false,
        message: "User already exists. Please sign in.",
      };
    }

    // Create user in MySQL
    await createUser({
      id: uid,
      name,
      email,
    });

    logger.info(`[Auth] User created in MySQL: ${uid}`);

    return {
      success: true,
      message: "Account created successfully.",
    };
  } catch (error: any) {
    logger.error("[Auth] Error creating user:", error);

    return {
      success: false,
      message: "Failed to create account. Please try again.",
    };
  }
}

/**
 * Sign in user (Clerk handles authentication, we just verify user exists in DB)
 */
export async function signIn(params: SignInParams) {
  const { email } = params;

  try {
    // Verify user exists in MySQL
    const user = await getUserByEmail(email);
    if (!user) {
      return {
        success: false,
        message: "User does not exist. Create an account.",
      };
    }

    logger.info(`[Auth] User signed in: ${user.id}`);

    return {
      success: true,
      message: "Signed in successfully.",
    };
  } catch (error: any) {
    logger.error("[Auth] Error signing in:", error);

    return {
      success: false,
      message: "Failed to log into account. Please try again.",
    };
  }
}

/**
 * Get current user from Clerk session
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return null;
    }

    // Get user from MySQL
    const user = await getUserById(userId);
    if (!user) {
      logger.warn(`[Auth] Clerk user ${userId} not found in MySQL`);
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      premium_user: user.premium_user,
    } as User;
  } catch (error) {
    logger.error("[Auth] Error getting current user:", error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { userId } = await auth();
  return !!userId;
}

/**
 * Get current user ID from Clerk
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}
