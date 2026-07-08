-- ============================================
-- Privacy: interviews generated with resume context contain questions
-- tailored to the creator's personal background. Flag them so they are
-- excluded from community-facing lists (Discover).
-- Existing rows default to false (pre-flag rows cannot be classified).
-- ============================================
ALTER TABLE interviews
  ADD COLUMN used_resume BOOLEAN NOT NULL DEFAULT false
  COMMENT 'Generated with the creator''s resume context — private to creator';
