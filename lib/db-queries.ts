/**
 * lib/db-queries.ts
 *
 * MySQL data access layer for users, interviews, and feedbacks.
 * Replaces Firebase Firestore operations with SQL queries.
 */

import { getPool } from './db';
import { logger } from './logger';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { cache } from 'react';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Safely parse JSON value that might already be parsed by MySQL driver
 */
function safeJsonParse<T>(value: any): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value as T;
}

// ============================================
// TYPES & INTERFACES
// ============================================

export interface User {
  id: string;
  name: string;
  email: string;
  premium_user: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Interview {
  id: string;
  user_id: string;
  role: string;
  type: string;
  level: string;
  techstack: string[];  // Stored as JSON in DB
  questions: string[];  // Stored as JSON in DB
  finalized: boolean;
  cover_image: string | null;
  created_at: Date;
}

export interface CategoryScore {
  name: string;
  score: number;
  comment: string;
}

export interface Feedback {
  id: string;
  interview_id: string;
  user_id: string;
  total_score: number;
  category_scores: CategoryScore[];  // Stored as JSON in DB
  strengths: string[];  // Stored as JSON in DB
  areas_for_improvement: string[];  // Stored as JSON in DB
  final_assessment: string;
  created_at: Date;
}

// ============================================
// USER OPERATIONS
// ============================================

/**
 * Create a new user
 */
export async function createUser(userData: {
  id: string;
  name: string;
  email: string;
}): Promise<User> {
  const pool = getPool();

  try {
    console.log('[DB] Creating user:', userData.id, userData.email);
    const result = await pool.execute(
      `INSERT INTO users (id, name, email, premium_user, created_at, updated_at)
       VALUES (?, ?, ?, false, NOW(), NOW())`,
      [userData.id, userData.name, userData.email]
    );

    console.log('[DB] User created successfully:', userData.id, 'Result:', result);
    logger.info(`[DB] User created: ${userData.id}`);

    return {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      premium_user: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
  } catch (error: any) {
    console.error('[DB] Error creating user:', error);
    logger.error(`[DB] Error creating user:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get existing user or create if doesn't exist (atomic operation)
 * Handles race conditions and duplicate inserts gracefully
 */
export async function getOrCreateUser(userData: {
  id: string;
  name: string;
  email: string;
}): Promise<User> {
  const pool = getPool();

  try {
    // First, try to get existing user
    const existingUser = await getUserById(userData.id);

    if (existingUser) {
      return existingUser;
    }

    // User doesn't exist, try to create
    try {
      await pool.execute(
        `INSERT INTO users (id, name, email, premium_user, created_at, updated_at)
         VALUES (?, ?, ?, false, NOW(), NOW())`,
        [userData.id, userData.name, userData.email]
      );

      logger.info(`[DB] User created: ${userData.id}`);

      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        premium_user: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
    } catch (insertError: any) {
      // Handle duplicate key error (race condition - another request created the user)
      if (insertError.code === 'ER_DUP_ENTRY') {
        const user = await getUserById(userData.id);
        if (user) return user;
      }
      throw insertError;
    }
  } catch (error: any) {
    console.error('[DB] Error in getOrCreateUser:', error);
    logger.error(`[DB] Error in getOrCreateUser:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get user by ID
 * Cached to prevent duplicate queries during a single request
 */
export const getUserById = cache(async (userId: string): Promise<User | null> => {
  const pool = getPool();

  try {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM users WHERE id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as User;
  } catch (error: any) {
    console.error('[DB] Error fetching user:', error);
    logger.error(`[DB] Error fetching user:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
});

/**
 * Get user by email
 * Cached to prevent duplicate queries during a single request
 */
export const getUserByEmail = cache(async (email: string): Promise<User | null> => {
  const pool = getPool();

  try {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as User;
  } catch (error: any) {
    logger.error(`[DB] Error fetching user by email:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
});

/**
 * Update user premium status
 */
export async function updateUserPremiumStatus(userId: string, isPremium: boolean): Promise<void> {
  const pool = getPool();

  try {
    await pool.execute(
      `UPDATE users SET premium_user = ?, updated_at = NOW() WHERE id = ?`,
      [isPremium, userId]
    );

    logger.info(`[DB] User premium status updated: ${userId} -> ${isPremium}`);
  } catch (error: any) {
    logger.error(`[DB] Error updating premium status:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get user's interview and feedback counts
 */
export async function getUserCounts(userId: string): Promise<{
  interviewCount: number;
  feedbackCount: number;
}> {
  const pool = getPool();

  try {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT
        COUNT(DISTINCT i.id) as interview_count,
        COUNT(DISTINCT f.id) as feedback_count
       FROM users u
       LEFT JOIN interviews i ON u.id = i.user_id
       LEFT JOIN feedbacks f ON u.id = f.user_id
       WHERE u.id = ?
       GROUP BY u.id`,
      [userId]
    );

    if (rows.length === 0) {
      return { interviewCount: 0, feedbackCount: 0 };
    }

    return {
      interviewCount: rows[0].interview_count || 0,
      feedbackCount: rows[0].feedback_count || 0,
    };
  } catch (error: any) {
    logger.error(`[DB] Error fetching user counts:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

// ============================================
// INTERVIEW OPERATIONS
// ============================================

/**
 * Create a new interview
 */
export async function createInterview(interviewData: {
  user_id: string;
  role: string;
  type: string;
  level: string;
  techstack: string[];
  questions: string[];
  finalized?: boolean;
  cover_image?: string;
}): Promise<Interview> {
  const pool = getPool();
  const id = uuidv4();

  try {
    await pool.execute(
      `INSERT INTO interviews
       (id, user_id, role, type, level, techstack, questions, finalized, cover_image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        interviewData.user_id,
        interviewData.role,
        interviewData.type,
        interviewData.level,
        JSON.stringify(interviewData.techstack),
        JSON.stringify(interviewData.questions),
        interviewData.finalized || false,
        interviewData.cover_image || null,
      ]
    );

    // Also insert into junction table
    await pool.execute(
      `INSERT INTO user_interviews (user_id, interview_id, created_at) VALUES (?, ?, NOW())`,
      [interviewData.user_id, id]
    );

    logger.info(`[DB] Interview created: ${id}`);

    return {
      id,
      ...interviewData,
      finalized: interviewData.finalized || false,
      cover_image: interviewData.cover_image || null,
      created_at: new Date(),
    };
  } catch (error: any) {
    logger.error(`[DB] Error creating interview:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get interview by ID
 * Cached to prevent duplicate queries during a single request
 */
export const getInterviewById = cache(async (interviewId: string): Promise<Interview | null> => {
  const pool = getPool();

  try {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM interviews WHERE id = ?`,
      [interviewId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      ...row,
      techstack: safeJsonParse<string[]>(row.techstack),
      questions: safeJsonParse<string[]>(row.questions),
    } as Interview;
  } catch (error: any) {
    logger.error(`[DB] Error fetching interview:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
});

/**
 * Get interviews by user ID
 */
export async function getInterviewsByUserId(userId: string): Promise<Interview[]> {
  const pool = getPool();

  try {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM interviews
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    return rows.map((row) => ({
      ...row,
      techstack: safeJsonParse<string[]>(row.techstack),
      questions: safeJsonParse<string[]>(row.questions),
    })) as Interview[];
  } catch (error: any) {
    logger.error(`[DB] Error fetching interviews by user:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get latest finalized interviews
 */
export async function getLatestInterviews(limit: number = 20): Promise<Interview[]> {
  const pool = getPool();

  try {
    // LIMIT clause cannot use placeholders in mysql2, so we use direct interpolation
    // Safe because limit is a number
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM interviews
       WHERE finalized = true
       ORDER BY created_at DESC
       LIMIT ${parseInt(String(limit), 10)}`
    );

    return rows.map((row) => ({
      ...row,
      techstack: safeJsonParse<string[]>(row.techstack),
      questions: safeJsonParse<string[]>(row.questions),
    })) as Interview[];
  } catch (error: any) {
    logger.error(`[DB] Error fetching latest interviews:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get latest interviews excluding a specific user
 */
export async function getLatestInterviewsExcludingUser(
  excludeUserId: string,
  limit: number = 20
): Promise<Interview[]> {
  const pool = getPool();

  try {
    // LIMIT clause cannot use placeholders in mysql2, so we use direct interpolation
    // Safe because limit is a number
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM interviews
       WHERE finalized = true AND user_id != ?
       ORDER BY created_at DESC
       LIMIT ${parseInt(String(limit), 10)}`,
      [excludeUserId]
    );

    return rows.map((row) => ({
      ...row,
      techstack: safeJsonParse<string[]>(row.techstack),
      questions: safeJsonParse<string[]>(row.questions),
    })) as Interview[];
  } catch (error: any) {
    logger.error(`[DB] Error fetching interviews:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get total interview count
 */
export async function getTotalInterviewCount(): Promise<number> {
  const pool = getPool();

  try {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM interviews`
    );

    return rows[0].count || 0;
  } catch (error: any) {
    logger.error(`[DB] Error counting interviews:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

// ============================================
// FEEDBACK OPERATIONS
// ============================================

/**
 * Create or update feedback
 */
export async function createFeedback(feedbackData: {
  id?: string;
  interview_id: string;
  user_id: string;
  total_score: number;
  category_scores: CategoryScore[];
  strengths: string[];
  areas_for_improvement: string[];
  final_assessment: string;
}): Promise<Feedback> {
  const pool = getPool();
  const id = feedbackData.id || uuidv4();

  try {
    // Check if feedback already exists
    const [existing] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM feedbacks WHERE interview_id = ? AND user_id = ?`,
      [feedbackData.interview_id, feedbackData.user_id]
    );

    if (existing.length > 0) {
      // Update existing feedback
      await pool.execute(
        `UPDATE feedbacks
         SET total_score = ?, category_scores = ?, strengths = ?,
             areas_for_improvement = ?, final_assessment = ?
         WHERE id = ?`,
        [
          feedbackData.total_score,
          JSON.stringify(feedbackData.category_scores),
          JSON.stringify(feedbackData.strengths),
          JSON.stringify(feedbackData.areas_for_improvement),
          feedbackData.final_assessment,
          existing[0].id,
        ]
      );

      logger.info(`[DB] Feedback updated: ${existing[0].id}`);
      return { ...feedbackData, id: existing[0].id, created_at: new Date() };
    }

    // Insert new feedback
    await pool.execute(
      `INSERT INTO feedbacks
       (id, interview_id, user_id, total_score, category_scores, strengths, areas_for_improvement, final_assessment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        feedbackData.interview_id,
        feedbackData.user_id,
        feedbackData.total_score,
        JSON.stringify(feedbackData.category_scores),
        JSON.stringify(feedbackData.strengths),
        JSON.stringify(feedbackData.areas_for_improvement),
        feedbackData.final_assessment,
      ]
    );

    // Also insert into junction table
    await pool.execute(
      `INSERT INTO user_feedbacks (user_id, feedback_id, created_at) VALUES (?, ?, NOW())`,
      [feedbackData.user_id, id]
    );

    logger.info(`[DB] Feedback created: ${id}`);

    return {
      ...feedbackData,
      id,
      created_at: new Date(),
    };
  } catch (error: any) {
    logger.error(`[DB] Error creating/updating feedback:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get feedback by interview ID and user ID
 */
export async function getFeedbackByInterviewAndUser(
  interviewId: string,
  userId: string
): Promise<Feedback | null> {
  const pool = getPool();

  try {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM feedbacks WHERE interview_id = ? AND user_id = ? LIMIT 1`,
      [interviewId, userId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      ...row,
      category_scores: safeJsonParse<CategoryScore[]>(row.category_scores),
      strengths: safeJsonParse<string[]>(row.strengths),
      areas_for_improvement: safeJsonParse<string[]>(row.areas_for_improvement),
    } as Feedback;
  } catch (error: any) {
    logger.error(`[DB] Error fetching feedback:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Get feedback count for a user
 */
export async function getFeedbackCountByUser(userId: string): Promise<number> {
  const pool = getPool();

  try {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM feedbacks WHERE user_id = ?`,
      [userId]
    );

    return rows[0].count || 0;
  } catch (error: any) {
    logger.error(`[DB] Error counting feedbacks:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}
