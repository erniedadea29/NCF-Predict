// Shared CSV export helper (Section 1h — Export Report (CSV) across every
// active data view). Originally written ad hoc inside LiquidationReportDashboard
// and TransactionsView; pulled out here so every other view can reuse the same
// escaping/download logic instead of re-implementing it.

// Escapes a value for safe CSV placement (wraps in quotes, doubles inner quotes)
export const csvEscape = (val: string | number | null | undefined) => {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

// Builds a CSV string from a header row + data rows and triggers a browser
// download with a BOM so it opens cleanly in Excel.
export const downloadCsv = (
  filename: string,
  header: (string | number)[],
  dataRows: (string | number | null | undefined)[][]
) => {
  const rowsOut = [header, ...dataRows];
  const csvContent = rowsOut.map(row => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
