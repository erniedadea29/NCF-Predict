import { OFFICER_POSITION_LABELS } from '../types';

/** Same role names the system shows on the Header role badge. */
const ROLE_LABELS: Record<string, string> = {
  officer_treasurer: 'Treasurer',
  officer_governor: 'Governor',
  council_member: 'Council Member',
  csc_adviser: 'Adviser',
  dean: 'Dean',
  admin: 'System Admin',
  cashier: 'Cashier',
  student: 'Student',
  super_admin: 'Super Admin',
  employee: 'Employee'
};

/** Officer seat names the system stores in profiles.officer_position ("Vice Governor", "Auditor"...). */
const OFFICER_SEATS = new Set<string>(Object.values(OFFICER_POSITION_LABELS));

/**
 * Title shown next to a person's name, following the system's own naming:
 * their officer seat if they hold one (e.g. "Vice Governor", "Auditor"),
 * otherwise their role as shown on the Header badge (e.g. "Adviser", "Dean").
 * officer_position values that aren't seats (like the "Employee"/"Student"
 * account type saved at registration) are ignored, since they go stale
 * once the person is promoted.
 */
export function roleLabel(role?: string | null, officerPosition?: string | null): string {
  if (officerPosition && OFFICER_SEATS.has(officerPosition)) return officerPosition;
  return (role && ROLE_LABELS[role]) || '';
}

/** "Nov 12, 2026, 1:11 PM" from an ISO timestamp; returns the input unchanged if it can't be parsed. */
export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
