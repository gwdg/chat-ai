import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateStructuredResponse, validateForm, sanitizeFormData } from '../../../src/utils/structuredToolValidation';

describe('Structured Tool Response Validation - Locked Feature', () => {
  const validSchema = {
    title: 'Test Form',
    description: 'Test Description',
    layout: 'vertical',
    fields: [
      {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
        required: true
      }
    ]
  };

  const validResponse = {
    type: 'structured_tool_response',
    version: '1.0',
    tool_id: 'test_tool',
    status: 'in_progress',
    data: {
      schema: validSchema,
      values: { testField: 'test value' },
      metadata: { tool_id: 'test_tool' }
    }
  };

  describe('validateStructuredResponse', () => {
    it('should validate response without locked field', () => {
      const result = validateStructuredResponse(validResponse);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate response with locked: false', () => {
      const responseWithLocked = { ...validResponse, locked: false };
      const result = validateStructuredResponse(responseWithLocked);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate response with locked: true', () => {
      const lockedResponse = { ...validResponse, locked: true };
      const result = validateStructuredResponse(lockedResponse);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should invalidate response with non-boolean locked value', () => {
      const invalidLockedResponse = { ...validResponse, locked: 'true' };
      const result = validateStructuredResponse(invalidLockedResponse);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid locked value - must be boolean');
    });

    it('should invalidate response with locked: null', () => {
      const invalidLockedResponse = { ...validResponse, locked: null };
      const result = validateStructuredResponse(invalidLockedResponse);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid locked value - must be boolean');
    });
  });

  describe('validateForm', () => {
    it('should validate form with valid values', () => {
      const formData = { testField: 'valid value' };
      const result = validateForm(validSchema, formData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should invalidate form with missing required field', () => {
      const formData = { testField: '' };
      const result = validateForm(validSchema, formData);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Test Field is required');
    });

    it('should validate form after unlock (re-validation)', () => {
      const formData = { testField: 'valid value' };
      const result = validateForm(validSchema, formData);
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitizeFormData', () => {
    it('should trim string values', () => {
      const formData = { testField: '  test value  ' };
      const sanitized = sanitizeFormData(formData);
      expect(sanitized.testField).toBe('test value');
    });

    it('should handle array of strings', () => {
      const formData = { arrayField: ['  value1  ', '  value2  '] };
      const sanitized = sanitizeFormData(formData);
      expect(sanitized.arrayField).toEqual(['value1', 'value2']);
    });

    it('should preserve non-string values', () => {
      const formData = { 
        numberField: 42,
        booleanField: true,
        objectField: { nested: 'value' }
      };
      const sanitized = sanitizeFormData(formData);
      expect(sanitized.numberField).toBe(42);
      expect(sanitized.booleanField).toBe(true);
      expect(sanitized.objectField).toEqual({ nested: 'value' });
    });
  });
});