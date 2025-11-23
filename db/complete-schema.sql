-- Complete MySQL Schema for Interview Application
-- Migrating from Firebase Firestore to MySQL
-- MySQL/MariaDB compatible

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY COMMENT 'Clerk user ID',
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  premium_user BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_email (email),
  INDEX idx_premium (premium_user),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='User accounts synced from Clerk authentication';

-- ============================================
-- INTERVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS interviews (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID for interview',
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL COMMENT 'Job role (e.g., Backend, Frontend)',
  type VARCHAR(100) NOT NULL COMMENT 'Interview type (e.g., Mixed, Technical)',
  level VARCHAR(100) NOT NULL COMMENT 'Experience level (e.g., Mid-Level, Senior)',
  techstack JSON NOT NULL COMMENT 'Array of technologies [React, Node.js, etc.]',
  questions JSON NOT NULL COMMENT 'Array of interview questions',
  finalized BOOLEAN DEFAULT false COMMENT 'Whether interview is completed',
  cover_image VARCHAR(255) DEFAULT NULL COMMENT 'Path to cover image (e.g., /covers/Nvidia.svg)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  INDEX idx_user_id (user_id),
  INDEX idx_finalized_created (finalized, created_at DESC),
  INDEX idx_user_finalized_created (user_id, finalized, created_at DESC),
  INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Interview sessions with questions and metadata';

-- ============================================
-- FEEDBACKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS feedbacks (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID for feedback',
  interview_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  total_score INT NOT NULL COMMENT 'Overall score (0-100)',
  category_scores JSON NOT NULL COMMENT 'Array of {name, score, comment} objects',
  strengths JSON NOT NULL COMMENT 'Array of strength descriptions',
  areas_for_improvement JSON NOT NULL COMMENT 'Array of improvement areas',
  final_assessment TEXT NOT NULL COMMENT 'Overall assessment text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  INDEX idx_interview_id (interview_id),
  INDEX idx_user_id (user_id),
  INDEX idx_interview_user (interview_id, user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Feedback and scores for completed interviews';

-- ============================================
-- VAPI CREDENTIALS TABLE (Already exists)
-- ============================================
-- This table is already created - just ensuring foreign key
ALTER TABLE user_vapi_keys
  ADD CONSTRAINT fk_vapi_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================
-- JUNCTION TABLES (For tracking relationships)
-- ============================================
-- These are optional - the foreign keys in interviews/feedbacks
-- already establish relationships. But they mirror Firebase's
-- structure where users have maps of interview/feedback refs.

CREATE TABLE IF NOT EXISTS user_interviews (
  user_id VARCHAR(255) NOT NULL,
  interview_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id, interview_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE,

  INDEX idx_user_id (user_id),
  INDEX idx_interview_id (interview_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Junction table tracking user interview relationships';

CREATE TABLE IF NOT EXISTS user_feedbacks (
  user_id VARCHAR(255) NOT NULL,
  feedback_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id, feedback_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (feedback_id) REFERENCES feedbacks(id) ON DELETE CASCADE,

  INDEX idx_user_id (user_id),
  INDEX idx_feedback_id (feedback_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Junction table tracking user feedback relationships';

-- ============================================
-- SAMPLE QUERIES FOR TESTING
-- ============================================

-- Get user with interview and feedback counts
-- SELECT
--   u.id, u.name, u.email, u.premium_user,
--   COUNT(DISTINCT i.id) as interview_count,
--   COUNT(DISTINCT f.id) as feedback_count
-- FROM users u
-- LEFT JOIN interviews i ON u.id = i.user_id
-- LEFT JOIN feedbacks f ON u.id = f.user_id
-- GROUP BY u.id;

-- Get latest finalized interviews
-- SELECT * FROM interviews
-- WHERE finalized = true
-- ORDER BY created_at DESC
-- LIMIT 20;

-- Get interviews with feedback for a user
-- SELECT
--   i.*,
--   f.total_score,
--   f.final_assessment
-- FROM interviews i
-- LEFT JOIN feedbacks f ON i.id = f.interview_id
-- WHERE i.user_id = 'user_123'
-- ORDER BY i.created_at DESC;

-- Get all premium users
-- SELECT * FROM users WHERE premium_user = true;

-- Search interviews by techstack (JSON query)
-- SELECT * FROM interviews
-- WHERE JSON_CONTAINS(techstack, '"React"')
-- ORDER BY created_at DESC;

-- Get average score by user
-- SELECT
--   u.id, u.name,
--   AVG(f.total_score) as avg_score,
--   COUNT(f.id) as feedback_count
-- FROM users u
-- JOIN feedbacks f ON u.id = f.user_id
-- GROUP BY u.id
-- HAVING avg_score > 70
-- ORDER BY avg_score DESC;
