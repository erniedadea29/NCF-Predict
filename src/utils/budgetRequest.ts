import type { BudgetProposal, User } from '../types';

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
