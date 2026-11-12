import type { NotificationItem, UserRole } from '../types';

/**
 * Where clicking a notification should take the user.
 *
 * Notifications carry an optional `link_tab` (set by whoever created them,
 * often a database function). It's matched against the tabs this user
 * actually has; if it's missing or not valid for their role, the target is
 * inferred from the notification's title/body. Falls back to the user's
 * first tab, so a click never leads to a page they can't open.
 */

/** Different spellings of the same destination -> canonical tab id. */
const ALIASES: Record<string, string> = {
  budget: 'budget', budgets: 'budget', proposal: 'budget', proposals: 'budget', budget_proposals: 'budget',
  budget_request: 'budget', budget_requests: 'budget', budget_approvals: 'budget_approvals', approvals: 'budget_approvals',
  reimbursement: 'reimbursement', reimbursements: 'reimbursement', reimburse: 'reimbursement',
  liquidation: 'liquidation_reports', liquidations: 'liquidation_reports', liquidation_reports: 'liquidation_reports',
  saf: 'saf_students', saf_students: 'saf_students', students: 'saf_students',
  events: 'events_attendance', events_attendance: 'events_attendance', events_penalties: 'events_attendance',
  penalties: 'events_attendance', attendance: 'events_attendance',
  transactions: 'transactions', transaction: 'transactions',
  expenses: 'expenses', forecast: 'forecast', ml_forecast: 'forecast',
  manage_users: 'manage_users', users: 'manage_users',
  past_officer: 'past_officer', past_adviser: 'past_adviser', handover: 'past_officer',
  student_portal: 'student_portal', portal: 'student_portal', receipts: 'student_portal', clearance: 'student_portal',
  home: 'home', dashboard: 'home'
};

/** Keyword -> tab, checked in order against the title + body. */
const KEYWORDS: [RegExp, string][] = [
  [/liquidat/i, 'liquidation_reports'],
  [/reimburs/i, 'reimbursement'],
  [/budget|proposal|fund release|cash.?out|request/i, 'budget'],
  [/receipt|clearance/i, 'student_portal'],
  [/\bsaf\b|activity fund|payment/i, 'saf_students'],
  [/penalt|fine|attendance|event/i, 'events_attendance'],
  [/handover/i, 'past_officer'],
  [/transaction|expense|income/i, 'transactions'],
  [/promot|account|role|officer position|adviser|dean/i, 'manage_users']
];

/** Same destination, but under the tab this role actually has. */
function forRole(tab: string, role: UserRole): string[] {
  const isStudent = role === 'student';
  const isReviewer = role === 'csc_adviser' || role === 'dean';
  switch (tab) {
    case 'budget':
    case 'budget_approvals':
      return isStudent ? ['expenses'] : isReviewer ? ['budget_approvals'] : ['budget'];
    case 'saf_students':
      return isStudent ? ['student_portal'] : ['saf_students'];
    case 'student_portal':
      return isStudent ? ['student_portal'] : ['saf_students'];
    case 'transactions':
    case 'expenses':
      return isStudent ? ['expenses'] : ['transactions'];
    case 'past_officer':
    case 'past_adviser':
      return role === 'dean' ? ['past_adviser'] : role === 'csc_adviser' ? ['past_officer'] : ['manage_users'];
    default:
      return [tab];
  }
}

export function resolveNotificationTab(n: NotificationItem, role: UserRole, allowedTabs: string[]): string | null {
  const allowed = new Set(allowedTabs);
  const pick = (tab: string | undefined) => (tab ? forRole(tab, role).find(t => allowed.has(t)) : undefined);

  const fromLink = n.link_tab ? pick(ALIASES[n.link_tab.trim().toLowerCase()] ?? n.link_tab.trim().toLowerCase()) : undefined;
  if (fromLink) return fromLink;

  const text = `${n.title} ${n.body || ''}`;
  for (const [pattern, tab] of KEYWORDS) {
    if (pattern.test(text)) {
      const t = pick(tab);
      if (t) return t;
    }
  }
  return allowedTabs[0] ?? null;
}

/** Human label for the destination, e.g. "Liquidation Reports". */
export function tabLabel(tabId: string, nav: { id: string; label: string }[]): string {
  return nav.find(item => item.id === tabId)?.label || tabId;
}
