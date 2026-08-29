import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  assertValidTransition,
  IllegalStateTransitionError,
  CaseState,
  TERMINAL_STATES
} from '../index.js';

describe('Authoritative State Machine', () => {
  it('should allow valid sequential progression', () => {
    expect(isValidTransition('DETECTED', 'DIAGNOSED')).toBe(true);
    expect(isValidTransition('DIAGNOSED', 'POLICY_EVALUATED')).toBe(true);
    expect(isValidTransition('POLICY_EVALUATED', 'ACTION_SCHEDULED')).toBe(true);
    expect(isValidTransition('POLICY_EVALUATED', 'AWAITING_APPROVAL')).toBe(true);
    expect(isValidTransition('ACTION_SCHEDULED', 'ACTION_EXECUTED')).toBe(true);
    expect(isValidTransition('ACTION_EXECUTED', 'RECOVERED')).toBe(true);
  });

  it('should allow approval workflow transitions', () => {
    expect(isValidTransition('POLICY_EVALUATED', 'AWAITING_APPROVAL')).toBe(true);
    expect(isValidTransition('AWAITING_APPROVAL', 'ACTION_SCHEDULED')).toBe(true);
    expect(isValidTransition('AWAITING_APPROVAL', 'ESCALATED')).toBe(true);
  });

  it('should reject terminal state regressions', () => {
    const allStates: CaseState[] = [
      'DETECTED', 'DIAGNOSED', 'POLICY_EVALUATED', 'AWAITING_APPROVAL',
      'ACTION_SCHEDULED', 'ACTION_EXECUTED', 'OUTCOME_UNKNOWN', 'RECONCILING'
    ];

    for (const terminal of TERMINAL_STATES) {
      for (const target of allStates) {
        expect(isValidTransition(terminal, target)).toBe(false);
        expect(() => assertValidTransition(terminal, target, 'case-123')).toThrow(
          IllegalStateTransitionError
        );
      }
    }
  });

  it('should enforce double-charge freeze on OUTCOME_UNKNOWN', () => {
    // Cannot skip reconciliation
    expect(isValidTransition('OUTCOME_UNKNOWN', 'ACTION_SCHEDULED')).toBe(false);
    expect(isValidTransition('OUTCOME_UNKNOWN', 'ACTION_EXECUTED')).toBe(false);
    expect(isValidTransition('OUTCOME_UNKNOWN', 'RECOVERED')).toBe(false);

    // Can only transition to RECONCILING
    expect(isValidTransition('OUTCOME_UNKNOWN', 'RECONCILING')).toBe(true);
    expect(() => assertValidTransition('OUTCOME_UNKNOWN', 'ACTION_SCHEDULED', 'case-timeout')).toThrow(
      /Double-charge protection active/
    );
  });

  it('should allow Reconciler to resolve case', () => {
    expect(isValidTransition('RECONCILING', 'RECOVERED')).toBe(true);
    expect(isValidTransition('RECONCILING', 'ACTION_SCHEDULED')).toBe(true);
    expect(isValidTransition('RECONCILING', 'EXHAUSTED')).toBe(true);
    expect(isValidTransition('RECONCILING', 'ESCALATED')).toBe(true);
  });

  it('should forbid jumping over policy engine', () => {
    expect(isValidTransition('DETECTED', 'ACTION_SCHEDULED')).toBe(false);
    expect(isValidTransition('DIAGNOSED', 'ACTION_SCHEDULED')).toBe(false);
  });
});
