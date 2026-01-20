/**
 * lib/version.ts
 *
 * Version parsing and comparison utilities for resource names.
 * Supports version suffixes like _v1, _v2.1, _v1.2.3, etc.
 */

/**
 * Parse version string from a resource name.
 * Extracts version suffix matching pattern _v(\d+(?:\.\d+)*)
 *
 * @param name - Resource name (e.g., "Interview Prep_v2.1")
 * @returns Version string without "v" prefix, or null if no version found
 *
 * @example
 * parseVersionFromName("Interview Prep_v2.1") // returns "2.1"
 * parseVersionFromName("Interview Prep") // returns null
 * parseVersionFromName("Tool_v1") // returns "1"
 */
export function parseVersionFromName(name: string): string | null {
  if (!name || typeof name !== 'string') {
    return null;
  }

  const match = name.match(/_v(\d+(?:\.\d+)*)$/);
  return match ? match[1] : null;
}

/**
 * Compare two version strings numerically.
 * Supports semantic-like versioning (1.2.3).
 *
 * @param v1 - First version string (e.g., "1.2.3")
 * @param v2 - Second version string (e.g., "1.3.0")
 * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 *
 * @example
 * compareVersions("1.2.3", "1.2.4") // returns -1
 * compareVersions("2.0", "1.9.9") // returns 1
 * compareVersions("1.0", "1.0.0") // returns 0
 */
export function compareVersions(v1: string, v2: string): -1 | 0 | 1 {
  // Convert version strings to arrays of numbers
  const parts1 = v1.split('.').map(n => parseInt(n, 10));
  const parts2 = v2.split('.').map(n => parseInt(n, 10));

  // Pad shorter version with zeros
  const maxLength = Math.max(parts1.length, parts2.length);
  while (parts1.length < maxLength) parts1.push(0);
  while (parts2.length < maxLength) parts2.push(0);

  // Compare each component
  for (let i = 0; i < maxLength; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }

  return 0;
}

/**
 * Extract base name without version suffix
 *
 * @param name - Resource name with possible version suffix
 * @returns Base name without version
 *
 * @example
 * getBaseName("Interview Prep_v2.1") // returns "Interview Prep"
 * getBaseName("My Tool") // returns "My Tool"
 */
export function getBaseName(name: string): string {
  if (!name || typeof name !== 'string') {
    return name;
  }

  return name.replace(/_v\d+(?:\.\d+)*$/, '');
}

/**
 * Check if a version string is valid
 *
 * @param version - Version string to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * isValidVersion("1.2.3") // returns true
 * isValidVersion("1") // returns true
 * isValidVersion("v1.2") // returns false (should not include 'v' prefix)
 * isValidVersion("abc") // returns false
 */
export function isValidVersion(version: string): boolean {
  if (!version || typeof version !== 'string') {
    return false;
  }

  return /^\d+(?:\.\d+)*$/.test(version);
}

/**
 * Build a versioned name from base name and version
 *
 * @param baseName - Base name without version
 * @param version - Version string (without 'v' prefix)
 * @returns Versioned name
 *
 * @example
 * buildVersionedName("Interview Prep", "2.1") // returns "Interview Prep_v2.1"
 * buildVersionedName("My Tool", "1") // returns "My Tool_v1"
 */
export function buildVersionedName(baseName: string, version: string): string {
  if (!version || version === '0') {
    return baseName;
  }

  return `${baseName}_v${version}`;
}
