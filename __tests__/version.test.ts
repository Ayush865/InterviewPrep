/**
 * __tests__/version.test.ts
 *
 * Unit tests for version parsing and comparison utilities.
 */

import {
  parseVersionFromName,
  compareVersions,
  getBaseName,
  isValidVersion,
  buildVersionedName
} from '../lib/version';

describe('parseVersionFromName', () => {
  test('should parse version from name with _v suffix', () => {
    expect(parseVersionFromName('Interview Prep_v2')).toBe('2');
    expect(parseVersionFromName('Tool_v1.2.3')).toBe('1.2.3');
    expect(parseVersionFromName('My Assistant_v10')).toBe('10');
  });

  test('should return null for names without version', () => {
    expect(parseVersionFromName('Interview Prep')).toBeNull();
    expect(parseVersionFromName('Tool Name')).toBeNull();
    expect(parseVersionFromName('Something_v')).toBeNull();
  });

  test('should handle edge cases', () => {
    expect(parseVersionFromName('')).toBeNull();
    expect(parseVersionFromName('_v1')).toBe('1');
    expect(parseVersionFromName('Name_v1_v2')).toBe('2'); // Only last match
  });

  test('should not match invalid version patterns', () => {
    expect(parseVersionFromName('Name_v1.2.a')).toBeNull();
    expect(parseVersionFromName('Name_vabc')).toBeNull();
  });
});

describe('compareVersions', () => {
  test('should compare major versions correctly', () => {
    expect(compareVersions('2', '1')).toBe(1);
    expect(compareVersions('1', '2')).toBe(-1);
    expect(compareVersions('1', '1')).toBe(0);
  });

  test('should compare semantic versions correctly', () => {
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    expect(compareVersions('1.3.0', '1.2.9')).toBe(1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  test('should handle different version lengths', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.1', '1.0.1')).toBe(1);
    expect(compareVersions('1', '1.0')).toBe(0);
    expect(compareVersions('2', '1.9.9.9')).toBe(1);
  });

  test('should compare zero versions', () => {
    expect(compareVersions('0', '0')).toBe(0);
    expect(compareVersions('0', '1')).toBe(-1);
    expect(compareVersions('1', '0')).toBe(1);
  });
});

describe('getBaseName', () => {
  test('should remove version suffix', () => {
    expect(getBaseName('Interview Prep_v2')).toBe('Interview Prep');
    expect(getBaseName('Tool_v1.2.3')).toBe('Tool');
  });

  test('should return original name if no version', () => {
    expect(getBaseName('Interview Prep')).toBe('Interview Prep');
    expect(getBaseName('Tool Name')).toBe('Tool Name');
  });

  test('should handle edge cases', () => {
    expect(getBaseName('')).toBe('');
    expect(getBaseName('_v1')).toBe('');
  });
});

describe('isValidVersion', () => {
  test('should validate correct version strings', () => {
    expect(isValidVersion('1')).toBe(true);
    expect(isValidVersion('1.2')).toBe(true);
    expect(isValidVersion('1.2.3')).toBe(true);
    expect(isValidVersion('10.20.30')).toBe(true);
    expect(isValidVersion('0')).toBe(true);
  });

  test('should reject invalid version strings', () => {
    expect(isValidVersion('v1')).toBe(false);
    expect(isValidVersion('1.2.a')).toBe(false);
    expect(isValidVersion('abc')).toBe(false);
    expect(isValidVersion('')).toBe(false);
    expect(isValidVersion('1.')).toBe(false);
    expect(isValidVersion('.1')).toBe(false);
  });
});

describe('buildVersionedName', () => {
  test('should build versioned name correctly', () => {
    expect(buildVersionedName('Interview Prep', '1')).toBe('Interview Prep_v1');
    expect(buildVersionedName('Tool', '2.1.3')).toBe('Tool_v2.1.3');
  });

  test('should not add version for zero or empty', () => {
    expect(buildVersionedName('Interview Prep', '0')).toBe('Interview Prep');
    expect(buildVersionedName('Tool', '')).toBe('Tool');
  });
});

describe('Version comparison integration', () => {
  test('should correctly determine upgrade scenarios', () => {
    const scenarios = [
      { template: '2.0', user: '1.5', shouldUpgrade: true },
      { template: '1.5', user: '2.0', shouldUpgrade: false },
      { template: '1.0', user: '1.0', shouldUpgrade: false },
      { template: '1.0.1', user: '1.0.0', shouldUpgrade: true },
    ];

    scenarios.forEach(({ template, user, shouldUpgrade }) => {
      const comparison = compareVersions(template, user);
      expect(comparison > 0).toBe(shouldUpgrade);
    });
  });

  test('should handle version parsing and comparison flow', () => {
    const templateName = 'Interview Prep_v2.1';
    const userName1 = 'Interview Prep_v2.0';
    const userName2 = 'Interview Prep_v2.2';

    const templateVersion = parseVersionFromName(templateName);
    const userVersion1 = parseVersionFromName(userName1);
    const userVersion2 = parseVersionFromName(userName2);

    expect(templateVersion).toBe('2.1');
    expect(userVersion1).toBe('2.0');
    expect(userVersion2).toBe('2.2');

    expect(compareVersions(templateVersion!, userVersion1!)).toBe(1);
    expect(compareVersions(templateVersion!, userVersion2!)).toBe(-1);
  });
});
