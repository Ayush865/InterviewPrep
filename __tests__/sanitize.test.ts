/**
 * __tests__/sanitize.test.ts
 *
 * Unit tests for assistant and tool sanitization.
 */

import { sanitizeAssistant, sanitizeTool, validateAssistant, validateTool } from '../lib/vapi/sanitize';
import { Assistant, Tool } from '../lib/vapi/types';

describe('sanitizeAssistant', () => {
  const mockAssistant: Assistant = {
    id: 'asst_123',
    orgId: 'org_456',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    name: 'Test Assistant',
    owner: { id: 'user_789' },
    isServerUrlSecretSet: true,
    phoneNumbers: ['+1234567890'],
    billing: { plan: 'pro' },
    lastModifiedBy: 'user_789',
    _rev: 'rev_1',
    _id: 'internal_id',
    model: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7
    },
    firstMessage: 'Hello!',
    metadata: {
      version: '1.0'
    }
  };

  test('should remove all read-only fields', () => {
    const sanitized = sanitizeAssistant(mockAssistant);

    expect(sanitized.id).toBeUndefined();
    expect(sanitized.orgId).toBeUndefined();
    expect(sanitized.createdAt).toBeUndefined();
    expect(sanitized.updatedAt).toBeUndefined();
    expect(sanitized.owner).toBeUndefined();
    expect(sanitized.isServerUrlSecretSet).toBeUndefined();
    expect(sanitized.phoneNumbers).toBeUndefined();
    expect(sanitized.billing).toBeUndefined();
    expect(sanitized.lastModifiedBy).toBeUndefined();
    expect(sanitized._rev).toBeUndefined();
    expect(sanitized._id).toBeUndefined();
  });

  test('should keep valid fields', () => {
    const sanitized = sanitizeAssistant(mockAssistant);

    expect(sanitized.name).toBe('Test Assistant');
    expect(sanitized.model?.provider).toBe('openai');
    expect(sanitized.model?.model).toBe('gpt-4');
    expect(sanitized.firstMessage).toBe('Hello!');
    expect(sanitized.metadata?.version).toBe('1.0');
  });

  test('should inject tool IDs when provided', () => {
    const toolIds = ['tool_1', 'tool_2'];
    const sanitized = sanitizeAssistant(mockAssistant, toolIds);

    expect(sanitized.model?.toolIds).toEqual(toolIds);
  });

  test('should create model object if missing when injecting tool IDs', () => {
    const assistantWithoutModel: Assistant = {
      name: 'Test',
      model: undefined
    };

    const sanitized = sanitizeAssistant(assistantWithoutModel, ['tool_1']);

    expect(sanitized.model).toBeDefined();
    expect(sanitized.model?.toolIds).toEqual(['tool_1']);
  });

  test('should not modify original object', () => {
    const original = { ...mockAssistant };
    sanitizeAssistant(mockAssistant);

    expect(mockAssistant).toEqual(original);
  });

  test('should remove empty objects and arrays', () => {
    const assistantWithEmpties: Assistant = {
      name: 'Test',
      model: {
        provider: 'openai',
        model: 'gpt-4'
      },
      metadata: {},
      clientMessages: []
    };

    const sanitized = sanitizeAssistant(assistantWithEmpties);

    expect(sanitized.metadata).toBeUndefined();
    expect(sanitized.clientMessages).toBeUndefined();
  });
});

describe('sanitizeTool', () => {
  const mockTool: Tool = {
    id: 'tool_123',
    orgId: 'org_456',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    type: 'function',
    name: 'Test Tool',
    description: 'A test tool',
    owner: { id: 'user_789' },
    lastModifiedBy: 'user_789',
    _rev: 'rev_1',
    _id: 'internal_id',
    function: {
      name: 'testFunction',
      description: 'Does something',
      parameters: {
        type: 'object',
        properties: {
          param1: { type: 'string' }
        }
      }
    }
  };

  test('should remove all read-only fields', () => {
    const sanitized = sanitizeTool(mockTool);

    expect(sanitized.id).toBeUndefined();
    expect(sanitized.orgId).toBeUndefined();
    expect(sanitized.createdAt).toBeUndefined();
    expect(sanitized.updatedAt).toBeUndefined();
    expect(sanitized.owner).toBeUndefined();
    expect(sanitized.lastModifiedBy).toBeUndefined();
    expect(sanitized._rev).toBeUndefined();
    expect(sanitized._id).toBeUndefined();
  });

  test('should keep valid fields', () => {
    const sanitized = sanitizeTool(mockTool);

    expect(sanitized.type).toBe('function');
    expect(sanitized.name).toBe('Test Tool');
    expect(sanitized.description).toBe('A test tool');
    expect(sanitized.function?.name).toBe('testFunction');
  });

  test('should not modify original object', () => {
    const original = { ...mockTool };
    sanitizeTool(mockTool);

    expect(mockTool).toEqual(original);
  });

  test('should handle nested structures', () => {
    const complexTool: Tool = {
      type: 'function',
      name: 'Complex Tool',
      function: {
        name: 'complex',
        parameters: {
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: {
                deep: { type: 'string' }
              }
            }
          }
        }
      },
      messages: [
        { type: 'request-start', content: 'Starting...' },
        { type: 'request-complete', content: 'Done!' }
      ]
    };

    const sanitized = sanitizeTool(complexTool);

    expect(sanitized.function?.parameters?.properties?.nested).toBeDefined();
    expect(sanitized.messages).toHaveLength(2);
  });
});

describe('validateAssistant', () => {
  test('should validate assistant with name', () => {
    expect(validateAssistant({ name: 'Test Assistant' })).toBe(true);
  });

  test('should reject assistant without name', () => {
    expect(validateAssistant({})).toBe(false);
    expect(validateAssistant({ name: '' })).toBe(false);
  });
});

describe('validateTool', () => {
  test('should validate tool with type', () => {
    expect(validateTool({ type: 'function' })).toBe(true);
  });

  test('should reject tool without type', () => {
    expect(validateTool({})).toBe(false);
    expect(validateTool({ type: '' })).toBe(false);
  });
});

describe('Sanitization edge cases', () => {
  test('should handle deeply nested read-only fields', () => {
    const assistant: any = {
      name: 'Test',
      model: {
        provider: 'openai',
        nested: {
          id: 'should_be_removed',
          validField: 'should_stay'
        }
      }
    };

    const sanitized = sanitizeAssistant(assistant);

    expect(sanitized.model?.nested?.id).toBeUndefined();
    expect(sanitized.model?.nested?.validField).toBe('should_stay');
  });

  test('should handle arrays with objects containing read-only fields', () => {
    const tool: any = {
      type: 'function',
      name: 'Test',
      messages: [
        { type: 'request-start', id: 'should_be_removed', content: 'Hello' },
        { type: 'request-end', content: 'Bye' }
      ]
    };

    const sanitized = sanitizeTool(tool);

    expect(sanitized.messages?.[0].id).toBeUndefined();
    expect(sanitized.messages?.[0].content).toBe('Hello');
  });
});
