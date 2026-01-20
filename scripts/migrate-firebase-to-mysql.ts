/**
 * scripts/migrate-firebase-to-mysql.ts
 *
 * Migration script to transfer data from Firebase Firestore to MySQL
 *
 * Run this script with: npx ts-node scripts/migrate-firebase-to-mysql.ts
 *
 * IMPORTANT: Make sure to backup your databases before running this script!
 */

import { db as firebaseDb } from '../firebase/admin.js';
import { getPool } from '../lib/db.js';
import { logger } from '../lib/logger.js';

interface FirestoreUser {
  name: string;
  email: string;
  premium_user?: boolean;
  interviews?: { [key: string]: any };
  feedbacks?: { [key: string]: any };
  createdAt?: string;
}

interface FirestoreInterview {
  role: string;
  type: string;
  level: string;
  techstack: string[];
  questions: string[];
  userId: string;
  finalized: boolean;
  coverImage?: string;
  createdAt: string;
}

interface FirestoreFeedback {
  interviewId: string;
  userId: string;
  totalScore: number;
  categoryScores: Array<{
    name: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
}

async function migrateUsers() {
  logger.info('=== Starting User Migration ===');

  const usersSnapshot = await firebaseDb.collection('users').get();
  const pool = getPool();

  let successCount = 0;
  let errorCount = 0;

  for (const doc of usersSnapshot.docs) {
    try {
      const userData = doc.data() as FirestoreUser;

      await pool.execute(
        `INSERT INTO users (id, name, email, premium_user, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           email = VALUES(email),
           premium_user = VALUES(premium_user),
           updated_at = NOW()`,
        [
          doc.id,
          userData.name || 'User',
          userData.email,
          userData.premium_user === true,
        ]
      );

      successCount++;
      logger.info(`✅ Migrated user: ${doc.id}`);
    } catch (error) {
      errorCount++;
      logger.error(`❌ Error migrating user ${doc.id}:`, error);
    }
  }

  logger.info(`User Migration Complete: ${successCount} success, ${errorCount} errors`);
  return { success: successCount, errors: errorCount };
}

async function migrateInterviews() {
  logger.info('=== Starting Interview Migration ===');

  const interviewsSnapshot = await firebaseDb.collection('interviews').get();
  const pool = getPool();

  let successCount = 0;
  let errorCount = 0;

  for (const doc of interviewsSnapshot.docs) {
    try {
      const interviewData = doc.data() as FirestoreInterview;

      // Parse created date
      const createdAt = interviewData.createdAt
        ? new Date(interviewData.createdAt)
        : new Date();

      await pool.execute(
        `INSERT INTO interviews
         (id, user_id, role, type, level, techstack, questions, finalized, cover_image, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           user_id = VALUES(user_id),
           role = VALUES(role),
           type = VALUES(type),
           level = VALUES(level),
           techstack = VALUES(techstack),
           questions = VALUES(questions),
           finalized = VALUES(finalized),
           cover_image = VALUES(cover_image)`,
        [
          doc.id,
          interviewData.userId,
          interviewData.role,
          interviewData.type,
          interviewData.level,
          JSON.stringify(interviewData.techstack || []),
          JSON.stringify(interviewData.questions || []),
          interviewData.finalized === true,
          interviewData.coverImage || null,
          createdAt,
        ]
      );

      // Also insert into junction table
      await pool.execute(
        `INSERT IGNORE INTO user_interviews (user_id, interview_id, created_at)
         VALUES (?, ?, ?)`,
        [interviewData.userId, doc.id, createdAt]
      );

      successCount++;
      logger.info(`✅ Migrated interview: ${doc.id}`);
    } catch (error) {
      errorCount++;
      logger.error(`❌ Error migrating interview ${doc.id}:`, error);
    }
  }

  logger.info(`Interview Migration Complete: ${successCount} success, ${errorCount} errors`);
  return { success: successCount, errors: errorCount };
}

async function migrateFeedbacks() {
  logger.info('=== Starting Feedback Migration ===');

  const feedbacksSnapshot = await firebaseDb.collection('feedback').get();
  const pool = getPool();

  let successCount = 0;
  let errorCount = 0;

  for (const doc of feedbacksSnapshot.docs) {
    try {
      const feedbackData = doc.data() as FirestoreFeedback;

      // Parse created date
      const createdAt = feedbackData.createdAt
        ? new Date(feedbackData.createdAt)
        : new Date();

      await pool.execute(
        `INSERT INTO feedbacks
         (id, interview_id, user_id, total_score, category_scores, strengths, areas_for_improvement, final_assessment, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           total_score = VALUES(total_score),
           category_scores = VALUES(category_scores),
           strengths = VALUES(strengths),
           areas_for_improvement = VALUES(areas_for_improvement),
           final_assessment = VALUES(final_assessment)`,
        [
          doc.id,
          feedbackData.interviewId,
          feedbackData.userId,
          feedbackData.totalScore,
          JSON.stringify(feedbackData.categoryScores || []),
          JSON.stringify(feedbackData.strengths || []),
          JSON.stringify(feedbackData.areasForImprovement || []),
          feedbackData.finalAssessment || '',
          createdAt,
        ]
      );

      // Also insert into junction table
      await pool.execute(
        `INSERT IGNORE INTO user_feedbacks (user_id, feedback_id, created_at)
         VALUES (?, ?, ?)`,
        [feedbackData.userId, doc.id, createdAt]
      );

      successCount++;
      logger.info(`✅ Migrated feedback: ${doc.id}`);
    } catch (error) {
      errorCount++;
      logger.error(`❌ Error migrating feedback ${doc.id}:`, error);
    }
  }

  logger.info(`Feedback Migration Complete: ${successCount} success, ${errorCount} errors`);
  return { success: successCount, errors: errorCount };
}

async function verifyMigration() {
  logger.info('=== Verifying Migration ===');

  const pool = getPool();

  // Count records in MySQL
  const [userRows] = await pool.execute('SELECT COUNT(*) as count FROM users');
  const [interviewRows] = await pool.execute('SELECT COUNT(*) as count FROM interviews');
  const [feedbackRows] = await pool.execute('SELECT COUNT(*) as count FROM feedbacks');

  const mysqlCounts = {
    users: (userRows as any)[0].count,
    interviews: (interviewRows as any)[0].count,
    feedbacks: (feedbackRows as any)[0].count,
  };

  // Count records in Firebase
  const usersSnapshot = await firebaseDb.collection('users').count().get();
  const interviewsSnapshot = await firebaseDb.collection('interviews').count().get();
  const feedbacksSnapshot = await firebaseDb.collection('feedback').count().get();

  const firebaseCounts = {
    users: usersSnapshot.data().count,
    interviews: interviewsSnapshot.data().count,
    feedbacks: feedbacksSnapshot.data().count,
  };

  logger.info('Firebase Counts:', firebaseCounts);
  logger.info('MySQL Counts:', mysqlCounts);

  const allMatch =
    mysqlCounts.users >= firebaseCounts.users &&
    mysqlCounts.interviews >= firebaseCounts.interviews &&
    mysqlCounts.feedbacks >= firebaseCounts.feedbacks;

  if (allMatch) {
    logger.info('✅ Migration verification PASSED');
  } else {
    logger.warn('⚠️  Migration verification FAILED - counts do not match');
  }

  return { firebaseCounts, mysqlCounts, verified: allMatch };
}

async function main() {
  try {
    logger.info('🚀 Starting Firebase to MySQL Migration');
    logger.info('⚠️  Please ensure you have backed up both databases before proceeding!');

    // Wait for user confirmation (in real usage, add a confirmation prompt)
    logger.info('Starting migration in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Migrate in order: users first, then interviews, then feedbacks
    const userResults = await migrateUsers();
    const interviewResults = await migrateInterviews();
    const feedbackResults = await migrateFeedbacks();

    // Verify migration
    const verification = await verifyMigration();

    logger.info('=== Migration Summary ===');
    logger.info(`Users: ${userResults.success} migrated, ${userResults.errors} errors`);
    logger.info(`Interviews: ${interviewResults.success} migrated, ${interviewResults.errors} errors`);
    logger.info(`Feedbacks: ${feedbackResults.success} migrated, ${feedbackResults.errors} errors`);
    logger.info(`Verification: ${verification.verified ? 'PASSED ✅' : 'FAILED ❌'}`);

    logger.info('🎉 Migration completed!');
    process.exit(0);
  } catch (error) {
    logger.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main();
