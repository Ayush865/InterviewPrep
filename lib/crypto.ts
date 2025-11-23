/**
 * lib/crypto.ts
 *
 * Encryption and decryption utilities using AES-256-GCM.
 *
 * ⚠️  SECURITY NOTE: This implementation uses a MASTER_KEY environment variable
 * for demonstration purposes. In production, replace with cloud KMS:
 * - AWS KMS: https://aws.amazon.com/kms/
 * - Google Cloud KMS: https://cloud.google.com/kms
 * - Azure Key Vault: https://azure.microsoft.com/en-us/services/key-vault/
 *
 * Production requirements:
 * - Use cloud KMS for key management
 * - Implement key rotation policies
 * - Use separate keys per environment
 * - Enable audit logging for all encryption operations
 * - Store keys in hardware security modules (HSM)
 */

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCODING = 'hex';

/**
 * Get or generate master encryption key
 * ⚠️  REPLACE THIS WITH CLOUD KMS IN PRODUCTION
 */
function getMasterKey(): Buffer {
  const masterKeyHex = process.env.MASTER_KEY;

  if (!masterKeyHex) {
    throw new Error(
      'MASTER_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  const key = Buffer.from(masterKeyHex, 'hex');

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `MASTER_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters). ` +
      `Current length: ${key.length} bytes.`
    );
  }

  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 *
 * Output format: iv:authTag:ciphertext (all hex-encoded)
 *
 * @param plaintext - Text to encrypt
 * @returns Encrypted string in format "iv:authTag:ciphertext"
 *
 * @example
 * const encrypted = encrypt("my-secret-api-key");
 * // Returns: "a1b2c3....:d4e5f6....:g7h8i9...."
 */
export function encrypt(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a non-empty string');
  }

  try {
    const key = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', ENCODING);
    ciphertext += cipher.final(ENCODING);

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext
    return [
      iv.toString(ENCODING),
      authTag.toString(ENCODING),
      ciphertext
    ].join(':');

  } catch (error: any) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt an encrypted string using AES-256-GCM
 *
 * @param encrypted - Encrypted string in format "iv:authTag:ciphertext"
 * @returns Decrypted plaintext
 *
 * @example
 * const plaintext = decrypt("a1b2c3....:d4e5f6....:g7h8i9....");
 * // Returns: "my-secret-api-key"
 */
export function decrypt(encrypted: string): string {
  if (!encrypted || typeof encrypted !== 'string') {
    throw new Error('Encrypted text must be a non-empty string');
  }

  try {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format. Expected "iv:authTag:ciphertext"');
    }

    const [ivHex, authTagHex, ciphertext] = parts;

    const key = getMasterKey();
    const iv = Buffer.from(ivHex, ENCODING);
    const authTag = Buffer.from(authTagHex, ENCODING);

    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: ${iv.length} bytes (expected ${IV_LENGTH})`);
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: ${authTag.length} bytes (expected ${AUTH_TAG_LENGTH})`);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, ENCODING, 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;

  } catch (error: any) {
    // Don't expose detailed decryption errors (could leak info)
    if (error.message.includes('Unsupported state or unable to authenticate data')) {
      throw new Error('Decryption failed: Authentication failed (data may be corrupted or tampered)');
    }
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Generate a new random master key (for initial setup)
 * ⚠️  Use this only once during initial setup, then store in secure location
 *
 * @returns Hex-encoded 256-bit key
 *
 * @example
 * const key = generateMasterKey();
 * console.log(`Add to .env: MASTER_KEY=${key}`);
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Hash a value (one-way, for comparison purposes)
 * Useful for logging or debugging without exposing sensitive data
 *
 * @param value - Value to hash
 * @returns SHA-256 hash (hex-encoded)
 */
export function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
