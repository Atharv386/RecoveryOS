import { describe, it, expect } from 'vitest';
import { DiagnosisOutputSchema } from '../schema.js';

describe('AI Diagnosis Schema Validation', () => {
  it('should validate conforming structured outputs', () => {
    const valid = {
      failure_class: 'INSUFFICIENT_FUNDS',
      confidence: 0.95,
      recommended_action: 'DELAYED_RETRY',
      recommended_delay_minutes: 360,
      reasoning: 'Customer account had insufficient balance at payment time.'
    };

    const parsed = DiagnosisOutputSchema.parse(valid);
    expect(parsed.failure_class).toBe('INSUFFICIENT_FUNDS');
    expect(parsed.confidence).toBe(0.95);
  });

  it('should reject invalid confidence scores', () => {
    const invalid = {
      failure_class: 'INSUFFICIENT_FUNDS',
      confidence: 1.5, // > 1.0 is invalid
      recommended_action: 'DELAYED_RETRY',
      recommended_delay_minutes: 360,
      reasoning: 'Test'
    };

    expect(() => DiagnosisOutputSchema.parse(invalid)).toThrow();
  });

  it('should reject unknown failure classes', () => {
    const invalid = {
      failure_class: 'INVALID_CATEGORY',
      confidence: 0.8,
      recommended_action: 'DELAYED_RETRY',
      recommended_delay_minutes: 10,
      reasoning: 'Test'
    };

    expect(() => DiagnosisOutputSchema.parse(invalid)).toThrow();
  });
});
