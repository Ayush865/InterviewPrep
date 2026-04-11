-- Migration 002: Create user_resumes table
-- Stores parsed resume data per user (one row per user, upserted on re-upload)
-- The full resume text is also stored in Upstash Vector with the user_id as the vector ID.

CREATE TABLE IF NOT EXISTS user_resumes (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY  COMMENT 'UUID',
  user_id         VARCHAR(255)  NOT NULL               COMMENT 'Clerk user ID (FK to users)',
  raw_text        LONGTEXT      NOT NULL               COMMENT 'Full extracted text from PDF/DOCX',
  parsed_role     VARCHAR(255)  DEFAULT NULL           COMMENT 'Extracted current/target role',
  parsed_level    VARCHAR(100)  DEFAULT NULL           COMMENT 'Inferred experience level (junior/mid/senior)',
  parsed_skills   JSON          DEFAULT NULL           COMMENT 'Array of technical skill strings',
  parsed_summary  TEXT          DEFAULT NULL           COMMENT 'Brief professional summary',
  file_name       VARCHAR(255)  DEFAULT NULL           COMMENT 'Original uploaded file name',
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_user_resume (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Parsed resume data per user. One active resume per user (upserted on re-upload).';
