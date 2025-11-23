"use server";

import {
  saveVapiCredentials,
  getAllVapiCredentials,
  deleteUserData,
} from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";

/**
 * Save user's VAPI credentials to MySQL database (encrypted)
 * Stores the web token, assistant ID, and tool ID
 */
export async function saveUserVapiCredentials(
  userId: string,
  credentials: {
    webToken: string;
    assistantId: string;
    toolId: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    if (!credentials.webToken || !credentials.assistantId) {
      return { success: false, error: "Web token and assistant ID are required" };
    }

    // Encrypt the web token before storing
    const encryptedWebToken = encrypt(credentials.webToken);

    // Save to MySQL database
    await saveVapiCredentials(
      userId,
      encryptedWebToken,
      credentials.assistantId,
      credentials.toolId || ''
    );

    logger.info(`✅ VAPI credentials saved to MySQL for user: ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error("Error saving VAPI credentials to MySQL:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save credentials"
    };
  }
}

/**
 * Fetch user's VAPI credentials from MySQL database (decrypted)
 * Returns null if no credentials are found
 */
export async function getUserVapiCredentials(
  userId: string
): Promise<{
  webToken: string | null;
  assistantId: string | null;
  toolId: string | null;
} | null> {
  try {
    if (!userId) {
      logger.error("User ID is required");
      return null;
    }

    // Fetch from MySQL
    const credentials = await getAllVapiCredentials(userId);

    if (!credentials) {
      logger.debug(`No VAPI credentials found in MySQL for user: ${userId}`);
      return null;
    }

    // Decrypt the web token if it exists
    let decryptedWebToken: string | null = null;
    if (credentials.encryptedWebToken) {
      try {
        decryptedWebToken = decrypt(credentials.encryptedWebToken);
      } catch (decryptError) {
        logger.error(`Failed to decrypt web token for user ${userId}:`, decryptError);
        // Return null web token but keep other credentials
      }
    }

    return {
      webToken: decryptedWebToken,
      assistantId: credentials.assistantId,
      toolId: credentials.toolId,
    };
  } catch (error) {
    logger.error("Error fetching VAPI credentials from MySQL:", error);
    return null;
  }
}

/**
 * Delete user's VAPI credentials from MySQL database
 */
export async function deleteUserVapiCredentials(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    // Delete from MySQL (this will delete the entire row including API key)
    await deleteUserData(userId);

    logger.info(`✅ VAPI credentials deleted from MySQL for user: ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error("Error deleting VAPI credentials from MySQL:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete credentials"
    };
  }
}

/**
 * Check if user has VAPI credentials stored in MySQL
 */
export async function hasUserVapiCredentials(userId: string): Promise<boolean> {
  try {
    const credentials = await getUserVapiCredentials(userId);
    return !!(credentials?.webToken && credentials?.assistantId);
  } catch (error) {
    logger.error("Error checking VAPI credentials in MySQL:", error);
    return false;
  }
}
