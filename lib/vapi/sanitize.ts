/**
 * lib/vapi/sanitize.ts
 *
 * Sanitizes assistant and tool JSON by removing read-only fields
 * before sending to Vapi API for creation.
 */

import { Assistant, Tool } from './types';
import { logger } from '../logger';

/**
 * Read-only fields that must be removed from assistants before creation/update
 */
const ASSISTANT_READONLY_FIELDS = [
  'id',
  '_id',
  'orgId',
  'createdAt',
  'updatedAt',
  'owner',
  'isServerUrlSecretSet',
  'phoneNumbers',
  'billing',
  'lastModifiedBy',
  '_rev'
];

/**
 * Read-only fields that must be removed from tools before creation/update
 */
const TOOL_READONLY_FIELDS = [
  'id',
  '_id',
  'orgId',
  'createdAt',
  'updatedAt',
  'owner',
  'lastModifiedBy',
  '_rev'
];

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Recursively remove specified fields from an object
 */
function removeFields(obj: any, fieldsToRemove: string[]): any {
  if (Array.isArray(obj)) {
    return obj.map(item => removeFields(item, fieldsToRemove));
  }

  if (obj !== null && typeof obj === 'object') {
    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (!fieldsToRemove.includes(key)) {
        result[key] = removeFields(value, fieldsToRemove);
      } else {
        logger.debug(`[Sanitize] Removing read-only field: ${key}`);
      }
    }

    return result;
  }

  return obj;
}

/**
 * Sanitize assistant JSON for creation/update
 * Optionally inject tool IDs into model.toolIds
 *
 * @param assistant - The assistant object to sanitize
 * @param toolIds - Optional array of tool IDs to inject
 * @returns Sanitized assistant object
 */
export function sanitizeAssistant(
  assistant: Assistant,
  toolIds?: string[]
): Partial<Assistant> {
  logger.debug(`[Sanitize] Sanitizing assistant: ${assistant.name}`);

  // Deep clone to avoid modifying original
  let sanitized = deepClone(assistant);

  // Remove read-only fields
  sanitized = removeFields(sanitized, ASSISTANT_READONLY_FIELDS);

  // Inject tool IDs if provided
  if (toolIds && toolIds.length > 0) {
    if (!sanitized.model) {
      sanitized.model = {
        provider: 'openai',
        model: 'gpt-4'
      };
    }

    sanitized.model.toolIds = toolIds;
    logger.debug(`[Sanitize] Injected tool IDs: ${toolIds.join(', ')}`);
  }

  // Remove empty/undefined fields
  const cleaned = removeEmptyFields(sanitized);

  logger.debug(`[Sanitize] Assistant sanitization complete`);
  return cleaned;
}

/**
 * Sanitize tool JSON for creation/update
 *
 * @param tool - The tool object to sanitize
 * @returns Sanitized tool object
 */
export function sanitizeTool(tool: Tool): Partial<Tool> {
  logger.debug(`[Sanitize] Sanitizing tool: ${tool.name}`);

  // Deep clone to avoid modifying original
  let sanitized = deepClone(tool);

  // Remove read-only fields
  sanitized = removeFields(sanitized, TOOL_READONLY_FIELDS);

  // Remove empty/undefined fields
  const cleaned = removeEmptyFields(sanitized);

  logger.debug(`[Sanitize] Tool sanitization complete`);
  return cleaned;
}

/**
 * Remove undefined and null fields recursively
 */
function removeEmptyFields(obj: any): any {
  if (Array.isArray(obj)) {
    return obj
      .map(item => removeEmptyFields(item))
      .filter(item => item !== undefined && item !== null);
  }

  if (obj !== null && typeof obj === 'object') {
    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        const cleaned = removeEmptyFields(value);
        if (cleaned !== undefined && cleaned !== null) {
          // Don't add empty objects or arrays
          if (typeof cleaned === 'object' && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0) {
            continue;
          }
          if (Array.isArray(cleaned) && cleaned.length === 0) {
            continue;
          }
          result[key] = cleaned;
        }
      }
    }

    return result;
  }

  return obj;
}

/**
 * Validate that required fields are present
 */
export function validateAssistant(assistant: Partial<Assistant>): boolean {
  if (!assistant.name || typeof assistant.name !== 'string') {
    logger.error('[Sanitize] Assistant validation failed: missing name');
    return false;
  }

  return true;
}

/**
 * Validate that required tool fields are present
 */
export function validateTool(tool: Partial<Tool>): boolean {
  if (!tool.type || typeof tool.type !== 'string') {
    logger.error('[Sanitize] Tool validation failed: missing type');
    return false;
  }

  return true;
}
