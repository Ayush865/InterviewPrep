-- Migration 001: Add company_name column to interviews table
-- Run this against the production MySQL database (Aiven)

ALTER TABLE interviews
  ADD COLUMN company_name VARCHAR(255) DEFAULT NULL
    COMMENT 'Optional company name selected during interview generation (e.g., google, amazon)'
  AFTER cover_image;

CREATE INDEX idx_company_name ON interviews (company_name);
