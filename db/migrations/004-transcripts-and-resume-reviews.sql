-- ============================================
-- 3.1 Progress story: store the full session transcript so users can
-- replay their answers (previously discarded after scoring).
-- ============================================
ALTER TABLE feedbacks
  ADD COLUMN transcript JSON NULL
  COMMENT 'Full session transcript: [{role, content}, ...]';

-- ============================================
-- 3.3 Resume wedge: AI resume reviews (Pro: 1/month, Elite: unlimited)
-- ============================================
CREATE TABLE IF NOT EXISTS resume_reviews (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID',
  user_id VARCHAR(255) NOT NULL,
  target_role VARCHAR(255) NULL,
  ats_score INT NOT NULL,
  summary TEXT NOT NULL,
  strengths JSON NOT NULL,
  issues JSON NOT NULL,
  bullet_rewrites JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_resume_reviews_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='AI resume reviews with ATS-style scoring';
