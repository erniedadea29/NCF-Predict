import type { BudgetProposal, LiquidationItem, LiquidationSummaryLine, User } from '../types';

/**
 * Only the Treasurer who filed the budget request prepares its liquidation
 * report. Requests with no recorded requester (e.g. that account was
 * deleted) fall back to any Treasurer of the same department.
 */
export function canPrepareLiquidation(proposal: BudgetProposal, user: User): boolean {
  if (user.role !== 'officer_treasurer') return false;
  if (proposal.requested_by) return proposal.requested_by === user.id;
  return proposal.department === user.department;
}

/** Groups itemized entries into the per-category summary stored on the report. */
export function summarizeLiquidationItems(items: LiquidationItem[]): LiquidationSummaryLine[] {
  const byCategory = new Map<string, LiquidationItem[]>();
  items.forEach(item => {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  });
  return [...byCategory.entries()].map(([category, list]) => ({
    category,
    spent: Math.round(list.reduce((s, i) => s + i.amount, 0) * 100) / 100,
    line_item_count: list.length,
    items: list
  }));
}

/** Flattens a stored summary back into its itemized entries (empty for older reports). */
export function liquidationItemsFromSummary(summary: LiquidationSummaryLine[]): LiquidationItem[] {
  return summary.flatMap(line => line.items ?? []);
}
