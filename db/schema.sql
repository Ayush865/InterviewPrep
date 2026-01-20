-- Database schema for Vapi cloning system
-- MySQL/MariaDB compatible

-- Create user_vapi_keys table
CREATE TABLE IF NOT EXISTS user_vapi_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  encrypted_api_key TEXT NOT NULL,
  web_token TEXT DEFAULT NULL COMMENT 'Encrypted public web token for Vapi SDK',
  assistant_id VARCHAR(255) DEFAULT NULL,
  tool_id VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migration: Add web_token column if it doesn't exist (for existing databases)
-- ALTER TABLE user_vapi_keys ADD COLUMN web_token TEXT DEFAULT NULL COMMENT 'Encrypted public web token for Vapi SDK' AFTER encrypted_api_key;

-- Create audit log table (optional, for tracking operations)
CREATE TABLE IF NOT EXISTS vapi_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) DEFAULT NULL,
  resource_id VARCHAR(255) DEFAULT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample queries for testing

-- Insert test user
-- INSERT INTO user_vapi_keys (user_id, encrypted_api_key)
-- VALUES ('test_user_123', 'encrypted_key_here');

-- Query user's data
-- SELECT * FROM user_vapi_keys WHERE user_id = 'test_user_123';

-- Update cloned resources
-- UPDATE user_vapi_keys
-- SET assistant_id = 'asst_abc123', tool_id = 'tool_xyz789', updated_at = NOW()
-- WHERE user_id = 'test_user_123';

-- Delete user data
-- DELETE FROM user_vapi_keys WHERE user_id = 'test_user_123';
