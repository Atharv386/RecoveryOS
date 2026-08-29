import { CaseState, TERMINAL_STATES } from './types.js';
import { IllegalStateTransitionError } from './errors.js';

export const ALLOWED_TRANSITIONS: Readonly<Record<CaseState, ReadonlySet<CaseState>>> = {
  DETECTED: new Set<CaseState>(['DIAGNOSED', 'RECOVERED']),
  DIAGNOSED: new Set<CaseState>(['POLICY_EVALUATED', 'RECOVERED']),
  POLICY_EVALUATED: new Set<CaseState>(['ACTION_SCHEDULED', 'AWAITING_APPROVAL', 'EXHAUSTED', 'RECOVERED']),
  AWAITING_APPROVAL: new Set<CaseState>(['ACTION_SCHEDULED', 'ESCALATED', 'EXHAUSTED', 'RECOVERED']),
  ACTION_SCHEDULED: new Set<CaseState>(['ACTION_EXECUTED', 'RECOVERED']),
  ACTION_EXECUTED: new Set<CaseState>([
    'RECOVERED',
    'ACTION_SCHEDULED',
    'OUTCOME_UNKNOWN',
    'EXHAUSTED'
  ]),
  OUTCOME_UNKNOWN: new Set<CaseState>(['RECONCILING']),
  RECONCILING: new Set<CaseState>([
    'RECOVERED',
    'ACTION_SCHEDULED',
    'EXHAUSTED',
    'ESCALATED'
  ]),
  RECOVERED: new Set<CaseState>(), // Terminal: No transitions allowed
  EXHAUSTED: new Set<CaseState>(), // Terminal: No transitions allowed
  ESCALATED: new Set<CaseState>()  // Terminal: No transitions allowed
};

/**
 * Checks if a transition between two states is valid according to the state machine.
 */
export function isValidTransition(fromState: CaseState, toState: CaseState): boolean {
  const allowed = ALLOWED_TRANSITIONS[fromState];
  return allowed ? allowed.has(toState) : false;
}

/**
 * Validates a transition and throws an IllegalStateTransitionError if forbidden.
 */
export function assertValidTransition(
  fromState: CaseState,
  toState: CaseState,
  caseId?: string
): void {
  if (TERMINAL_STATES.has(fromState)) {
    throw new IllegalStateTransitionError(
      fromState,
      toState,
      caseId,
      `State '${fromState}' is terminal and immutable`
    );
  }

  if (fromState === 'OUTCOME_UNKNOWN' && toState !== 'RECONCILING') {
    throw new IllegalStateTransitionError(
      fromState,
      toState,
      caseId,
      'Double-charge protection active: OUTCOME_UNKNOWN must be reconciled before taking action'
    );
  }

  if (!isValidTransition(fromState, toState)) {
    throw new IllegalStateTransitionError(fromState, toState, caseId);
  }
}
