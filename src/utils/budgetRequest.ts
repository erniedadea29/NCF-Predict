import type { BudgetProposal, User } from '../types';
import { OFFICER_POSITION_LABELS } from '../types';

/**
 * The Auditor only audits and views budget proposals: no drafting new
 * requests and no post-approval fund actions.
 */
export function isAuditor(user: Pick<User, 'officer_position'>): boolean {
  return (user.officer_position || '').trim().toLowerCase() === OFFICER_POSITION_LABELS.auditor.toLowerCase();
}

/**
 * True when the Adviser already approved and the Dean sent the request back
 * (revision / rejected): resubmitting it goes straight back to the Dean.
 * Mirrors submit_budget_request() in the database.
 */
export function returnsToDean(proposal: BudgetProposal): boolean {
  return (proposal.budget_status === 'FOR_REVISION' || proposal.budget_status === 'REJECTED')
    && proposal.adviser_approval?.decision === 'APPROVED'
    && (proposal.dean_approval?.decision === 'REVISION' || proposal.dean_approval?.decision === 'REJECTED');
}

/** Statuses in which the request's creator may still change a budget request. */
export const EDITABLE_REQUEST_STATUSES = ['DRAFT', 'FOR_REVISION', 'REJECTED'] as const;

/**
 * Whoever created the request (any officer role) can edit and (re)submit it
 * while it's a Draft, sent back For Revision, or Rejected. Requests with no
 * recorded creator fall back to a Treasurer of the same department.
 * Mirrors ncf_can_manage_request() in the database.
 */
export function canEditBudgetRequest(proposal: BudgetProposal, user: User): boolean {
  if (!(EDITABLE_REQUEST_STATUSES as readonly string[]).includes(proposal.budget_status)) return false;
  if (proposal.requested_by) return proposal.requested_by === user.id;
  return user.role === 'officer_treasurer' && proposal.department === user.department;
}
