-- ============================================
-- Track how each interview was generated so free-plan limits can be
-- method-specific: form generation is unlimited, hiring-manager call
-- generation is limited to 1.
-- Existing rows default to 'form' (the generous interpretation).
-- ============================================
ALTER TABLE interviews
  ADD COLUMN generation_method VARCHAR(10) NOT NULL DEFAULT 'form'
  COMMENT 'How the interview was generated: form | call';

CREATE INDEX idx_interviews_user_method
  ON interviews (user_id, generation_method);
