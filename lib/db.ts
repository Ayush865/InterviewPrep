/**
 * lib/db.ts
 *
 * Database helper functions for storing and retrieving user Vapi keys and resources.
 * Uses MySQL with connection pooling.
 */

import mysql from 'mysql2/promise';
import { logger } from './logger';

let pool: mysql.Pool | null = null;

/**
 * Get or create MySQL connection pool
 */
export function getPool(): mysql.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.error('[DB] DATABASE_URL environment variable is not set');
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Parse connection string
    // Format: mysql://user:password@host:port/database
    const match = connectionString.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

    if (!match) {
      console.error('[DB] Invalid DATABASE_URL format');
      throw new Error('Invalid DATABASE_URL format. Expected: mysql://user:password@host:port/database');
    }

    const [, user, password, host, port, database] = match;

    console.log('[DB] Creating MySQL connection pool to:', host, database);

    pool = mysql.createPool({
      host,
      port: parseInt(port, 10),
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    console.log('[DB] MySQL connection pool created successfully');
    logger.info('[DB] MySQL connection pool created');
  }

  return pool;
}

/**
 * Save or update user's encrypted API key
 *
 * @param userId - User ID
 * @param encryptedApiKey - Encrypted Vapi API key
 */
export async function saveApiKey(userId: string, encryptedApiKey: string): Promise<void> {
  const pool = getPool();

  try {
    const [result] = await pool.execute(
      `INSERT INTO user_vapi_keys (user_id, encrypted_api_key, created_at, updated_at)
       VALUES (?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         encrypted_api_key = VALUES(encrypted_api_key),
         updated_at = NOW()`,
      [userId, encryptedApiKey]
    );

    logger.info(`[DB] API key saved for user: ${userId}`);
  } catch (error: any) {
    logger.error(`[DB] Error saving API key:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get user's encrypted API key
 *
 * @param userId - User ID
 * @returns Encrypted API key or null if not found
 */
export async function getApiKey(userId: string): Promise<string | null> {
  const pool = getPool();

  try {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT encrypted_api_key FROM user_vapi_keys WHERE user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      logger.debug(`[DB] No API key found for user: ${userId}`);
      return null;
    }

    return rows[0].encrypted_api_key;
  } catch (error: any) {
    logger.error(`[DB] Error retrieving API key:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Save web token for a user (encrypted)
 *
 * @param userId - User ID
 * @param encryptedWebToken - Encrypted Vapi web token
 */
export async function saveWebToken(userId: string, encryptedWebToken: string): Promise<void> {
  const pool = getPool();

  try {
    await pool.execute(
      `UPDATE user_vapi_keys
       SET web_token = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [encryptedWebToken, userId]
    );

    logger.info(`[DB] Web token saved for user: ${userId}`);
  } catch (error: any) {
    logger.error(`[DB] Error saving web token:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get user's encrypted web token
 *
 * @param userId - User ID
 * @returns Encrypted web token or null if not found
 */
export async function getWebToken(userId: string): Promise<string | null> {
  const pool = getPool();

  try {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT web_token FROM user_vapi_keys WHERE user_id = ?`,
      [userId]
    );

    if (rows.length === 0 || !rows[0].web_token) {
      logger.debug(`[DB] No web token found for user: ${userId}`);
      return null;
    }

    return rows[0].web_token;
  } catch (error: any) {
    logger.error(`[DB] Error retrieving web token:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Save cloned assistant and tool IDs for a user
 *
 * @param userId - User ID
 * @param assistantId - Vapi assistant ID
 * @param toolId - Vapi tool ID
 */
export async function saveClonedResources(
  userId: string,
  assistantId: string,
  toolId: string
): Promise<void> {
  const pool = getPool();

  try {
    await pool.execute(
      `UPDATE user_vapi_keys
       SET assistant_id = ?, tool_id = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [assistantId, toolId, userId]
    );

    logger.info(`[DB] Cloned resources saved for user ${userId}: assistant=${assistantId}, tool=${toolId}`);
  } catch (error: any) {
    logger.error(`[DB] Error saving cloned resources:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Save all VAPI credentials at once (web token + cloned resources)
 *
 * @param userId - User ID
 * @param encryptedWebToken - Encrypted Vapi web token
 * @param assistantId - Vapi assistant ID
 * @param toolId - Vapi tool ID
 */
export async function saveVapiCredentials(
  userId: string,
  encryptedWebToken: string,
  assistantId: string,
  toolId: string
): Promise<void> {
  const pool = getPool();

  try {
    await pool.execute(
      `UPDATE user_vapi_keys
       SET web_token = ?, assistant_id = ?, tool_id = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [encryptedWebToken, assistantId, toolId, userId]
    );

    logger.info(`[DB] All VAPI credentials saved for user ${userId}`);
  } catch (error: any) {
    logger.error(`[DB] Error saving VAPI credentials:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get cloned resource IDs for a user
 *
 * @param userId - User ID
 * @returns Object with assistantId and toolId, or null if not found
 */
export async function getClonedResources(
  userId: string
): Promise<{ assistantId: string | null; toolId: string | null } | null> {
  const pool = getPool();

  try {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT assistant_id, tool_id FROM user_vapi_keys WHERE user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      assistantId: rows[0].assistant_id,
      toolId: rows[0].tool_id
    };
  } catch (error: any) {
    logger.error(`[DB] Error retrieving cloned resources:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get all VAPI credentials for a user (web token + resources)
 *
 * @param userId - User ID
 * @returns Object with encrypted web token, assistantId and toolId, or null if not found
 */
export async function getAllVapiCredentials(
  userId: string
): Promise<{
  encryptedWebToken: string | null;
  assistantId: string | null;
  toolId: string | null;
} | null> {
  const pool = getPool();

  try {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT web_token, assistant_id, tool_id FROM user_vapi_keys WHERE user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      encryptedWebToken: rows[0].web_token,
      assistantId: rows[0].assistant_id,
      toolId: rows[0].tool_id
    };
  } catch (error: any) {
    logger.error(`[DB] Error retrieving VAPI credentials:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Delete user's API key and associated resources
 *
 * @param userId - User ID
 */
export async function deleteUserData(userId: string): Promise<void> {
  const pool = getPool();

  try {
    await pool.execute(
      `DELETE FROM user_vapi_keys WHERE user_id = ?`,
      [userId]
    );

    logger.info(`[DB] User data deleted for: ${userId}`);
  } catch (error: any) {
    logger.error(`[DB] Error deleting user data:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT 1 as test');
    logger.info('[DB] Connection test successful');
    return true;
  } catch (error: any) {
    logger.error('[DB] Connection test failed:', error);
    return false;
  }
}

/**
 * Close database connection pool
 * Call this during graceful shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('[DB] Connection pool closed');
  }
}
