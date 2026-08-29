import { CaseState } from './types.js';

export class IllegalStateTransitionError extends Error {
  public readonly fromState: CaseState;
  public readonly toState: CaseState;
  public readonly caseId?: string;

  constructor(fromState: CaseState, toState: CaseState, caseId?: string, reason?: string) {
    const detail = reason ? ` (${reason})` : '';
    const caseInfo = caseId ? ` for Case [${caseId}]` : '';
    super(`Illegal state transition${caseInfo}: cannot transition from '${fromState}' to '${toState}'${detail}.`);
    this.name = 'IllegalStateTransitionError';
    this.fromState = fromState;
    this.toState = toState;
    this.caseId = caseId;
  }
}
