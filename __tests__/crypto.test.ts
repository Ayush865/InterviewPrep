/**
 * __tests__/crypto.test.ts
 *
 * Unit tests for encryption and decryption utilities.
 */

import { encrypt, decrypt, generateMasterKey, hash } from '../lib/crypto';

// Set test master key
const TEST_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.MASTER_KEY = TEST_MASTER_KEY;

describe('Encryption and Decryption', () => {
  test('should encrypt and decrypt text correctly', () => {
    const plaintext = 'my-secret-api-key';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  test('should produce different ciphertexts for same plaintext', () => {
    const plaintext = 'test-secret';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);

    // Should be different due to random IV
    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to same plaintext
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  test('should handle long text', () => {
    const longText = 'a'.repeat(10000);
    const encrypted = encrypt(longText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(longText);
  });

  test('should handle special characters', () => {
    const specialText = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`\n\t';
    const encrypted = encrypt(specialText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(specialText);
  });

  test('should handle unicode characters', () => {
    const unicodeText = 'Hello 世界 🌍 Привет';
    const encrypted = encrypt(unicodeText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(unicodeText);
  });

  test('encrypted text should have correct format', () => {
    const plaintext = 'test';
    const encrypted = encrypt(plaintext);

    // Format should be: iv:authTag:ciphertext
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);

    // IV should be 32 hex chars (16 bytes)
    expect(parts[0]).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(parts[0])).toBe(true);

    // Auth tag should be 32 hex chars (16 bytes)
    expect(parts[1]).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(parts[1])).toBe(true);

    // Ciphertext should be hex
    expect(/^[0-9a-f]+$/.test(parts[2])).toBe(true);
  });
});

describe('Encryption error handling', () => {
  test('should throw error for empty plaintext', () => {
    expect(() => encrypt('')).toThrow('Plaintext must be a non-empty string');
  });

  test('should throw error for non-string plaintext', () => {
    expect(() => encrypt(null as any)).toThrow('Plaintext must be a non-empty string');
    expect(() => encrypt(undefined as any)).toThrow('Plaintext must be a non-empty string');
    expect(() => encrypt(123 as any)).toThrow('Plaintext must be a non-empty string');
  });
});

describe('Decryption error handling', () => {
  test('should throw error for invalid format', () => {
    expect(() => decrypt('invalid')).toThrow('Invalid encrypted format');
    expect(() => decrypt('only:two')).toThrow('Invalid encrypted format');
    expect(() => decrypt('')).toThrow('Encrypted text must be a non-empty string');
  });

  test('should throw error for tampered data', () => {
    const plaintext = 'test-secret';
    const encrypted = encrypt(plaintext);

    // Tamper with ciphertext
    const parts = encrypted.split(':');
    parts[2] = parts[2].substring(0, parts[2].length - 2) + 'ff';
    const tampered = parts.join(':');

    expect(() => decrypt(tampered)).toThrow('Authentication failed');
  });

  test('should throw error for wrong IV length', () => {
    const invalidIV = 'abc:' + '0'.repeat(32) + ':' + '0'.repeat(16);
    expect(() => decrypt(invalidIV)).toThrow('Invalid IV length');
  });

  test('should throw error for wrong auth tag length', () => {
    const validIV = '0'.repeat(32);
    const invalidAuthTag = validIV + ':abc:' + '0'.repeat(16);
    expect(() => decrypt(invalidAuthTag)).toThrow('Invalid auth tag length');
  });
});

describe('Master key validation', () => {
  const originalKey = process.env.MASTER_KEY;

  afterEach(() => {
    process.env.MASTER_KEY = originalKey;
  });

  test('should throw error if MASTER_KEY is not set', () => {
    delete process.env.MASTER_KEY;
    expect(() => encrypt('test')).toThrow('MASTER_KEY environment variable is not set');
  });

  test('should throw error if MASTER_KEY has wrong length', () => {
    process.env.MASTER_KEY = 'tooshort';
    expect(() => encrypt('test')).toThrow('MASTER_KEY must be 32 bytes');
  });
});

describe('generateMasterKey', () => {
  test('should generate valid master key', () => {
    const key = generateMasterKey();

    expect(key).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(/^[0-9a-f]+$/.test(key)).toBe(true);
  });

  test('should generate different keys each time', () => {
    const key1 = generateMasterKey();
    const key2 = generateMasterKey();

    expect(key1).not.toBe(key2);
  });

  test('generated key should work for encryption', () => {
    const newKey = generateMasterKey();
    process.env.MASTER_KEY = newKey;

    const plaintext = 'test-with-new-key';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });
});

describe('hash', () => {
  test('should hash values consistently', () => {
    const value = 'test-value';
    const hash1 = hash(value);
    const hash2 = hash(value);

    expect(hash1).toBe(hash2);
  });

  test('should produce different hashes for different values', () => {
    const hash1 = hash('value1');
    const hash2 = hash('value2');

    expect(hash1).not.toBe(hash2);
  });

  test('should produce 64-character hex hash', () => {
    const hashed = hash('test');

    expect(hashed).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
    expect(/^[0-9a-f]+$/.test(hashed)).toBe(true);
  });
});

describe('Real-world scenarios', () => {
  test('should handle API key encryption/decryption', () => {
    const apiKey = 'sk_vapi_1234567890abcdefghijklmnopqrstuvwxyz';
    const encrypted = encrypt(apiKey);

    // Encrypted should not contain original key
    expect(encrypted).not.toContain(apiKey);

    // Should decrypt correctly
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(apiKey);
  });

  test('should handle multiple sequential encryptions', () => {
    const keys = [
      'key1',
      'key2',
      'key3'
    ];

    const encrypted = keys.map(k => encrypt(k));
    const decrypted = encrypted.map(e => decrypt(e));

    expect(decrypted).toEqual(keys);
  });
});
