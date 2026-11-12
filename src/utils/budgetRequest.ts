import type { BudgetProposal, User } from '../types';

/** Statuses in which the requesting Treasurer may still change a budget request. */
export const EDITABLE_REQUEST_STATUSES = ['DRAFT', 'FOR_REVISION', 'REJECTED'] as const;

/**
 * The Treasurer who filed the request can edit (and resubmit) it while it's a
 * Draft, sent back For Revision, or Rejected. Requests with no recorded
 * requester fall back to any Treasurer of the same department.
 */
export function canEditBudgetRequest(proposal: BudgetProposal, user: User): boolean {
  if (user.role !== 'officer_treasurer') return false;
  if (!(EDITABLE_REQUEST_STATUSES as readonly string[]).includes(proposal.budget_status)) return false;
  return proposal.requested_by ? proposal.requested_by === user.id : proposal.department === user.department;
}
