import { z } from 'zod';

export const CaseStateEnum = z.enum([
  'DETECTED',
  'DIAGNOSED',
  'POLICY_EVALUATED',
  'AWAITING_APPROVAL',
  'ACTION_SCHEDULED',
  'ACTION_EXECUTED',
  'OUTCOME_UNKNOWN',
  'RECONCILING',
  'RECOVERED',
  'EXHAUSTED',
  'ESCALATED'
]);

export type CaseState = z.infer<typeof CaseStateEnum>;

export const TERMINAL_STATES: ReadonlySet<CaseState> = new Set([
  'RECOVERED',
  'EXHAUSTED',
  'ESCALATED'
]);
