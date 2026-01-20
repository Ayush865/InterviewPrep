-- Safe Migration Schema for Existing Database
-- This version handles the case where user_vapi_keys table already exists
-- MySQL/MariaDB compatible

-- ============================================
-- STEP 1: Create new tables (users, interviews, feedbacks)
-- ============================================

-- USERS TABLE
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

-- INTERVIEWS TABLE
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

-- FEEDBACKS TABLE
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

-- JUNCTION TABLES
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
-- STEP 2: Update existing user_vapi_keys table
-- ============================================

-- Add web_token column if it doesn't exist
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'user_vapi_keys'
  AND COLUMN_NAME = 'web_token'
);

SET @sql := IF(@exists = 0,
  'ALTER TABLE user_vapi_keys ADD COLUMN web_token TEXT DEFAULT NULL COMMENT "Encrypted public web token for Vapi SDK" AFTER encrypted_api_key',
  'SELECT "Column web_token already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- IMPORTANT: Foreign key for user_vapi_keys
-- ============================================
-- This will be added AFTER you run the migration script
-- to ensure all users exist in the users table first.
--
-- Run this manually AFTER migration:
--
-- ALTER TABLE user_vapi_keys
--   DROP FOREIGN KEY IF EXISTS fk_vapi_user;
--
-- ALTER TABLE user_vapi_keys
--   ADD CONSTRAINT fk_vapi_user
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--
-- ============================================

-- Verification queries
SELECT 'Schema setup complete!' AS status;
SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('users', 'interviews', 'feedbacks', 'user_vapi_keys', 'user_interviews', 'user_feedbacks')
ORDER BY TABLE_NAME;
