import { getSupabase } from '../lib/supabaseClient';

/**
 * Receipt photos of an expense / reimbursement live in the private
 * `receipts` Storage bucket, one folder per expense:
 *   receipts/<department>/<proposalId>/x_<expenseId>/<time>_<file>
 * Older requests saved a single photo path in transactions.receipt_url;
 * that one is shown too.
 */
export const RECEIPT_BUCKET = 'receipts';
export const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_RECEIPT_SIZE = 8 * 1024 * 1024;

export interface ReceiptPhoto {
  path: string;
  name: string;
  isPdf: boolean;
  url: string | null; // short-lived signed link for viewing
}

export function expensePhotoFolder(department: string, proposalId: string, expenseId: string): string {
  return `${department}/${proposalId}/x_${expenseId}`;
}

/** Returns an error message for a file that can't be uploaded, else null. */
export function receiptFileProblem(file: File): string | null {
  if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG, WEBP or PDF files are allowed.`;
  if (file.size > MAX_RECEIPT_SIZE) return `${file.name}: file is too large (max 8MB).`;
  return null;
}

/** Uploads the files into the expense's folder. Returns the error messages (empty when all uploaded). */
export async function uploadExpensePhotos(folder: string, files: File[]): Promise<string[]> {
  const errors: string[] = [];
  for (const [i, file] of files.entries()) {
    const problem = receiptFileProblem(file);
    if (problem) { errors.push(problem); continue; }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const { error } = await getSupabase().storage
      .from(RECEIPT_BUCKET)
      .upload(`${folder}/${Date.now()}_${i}_${safeName}`, file, { contentType: file.type, upsert: false });
    if (error) errors.push(`${file.name}: ${error.message}`);
  }
  return errors;
}

/** Every photo of an expense (its folder plus the older single receipt_url), with view links. */
export async function listExpensePhotos(folder: string, legacyPath?: string | null): Promise<ReceiptPhoto[]> {
  const storage = getSupabase().storage.from(RECEIPT_BUCKET);
  const paths: string[] = [];
  if (legacyPath && legacyPath !== '#') paths.push(legacyPath);

  const { data: files, error } = await storage.list(folder, { limit: 100, sortBy: { column: 'name', order: 'asc' } });
  if (error) console.error('Failed to list receipt photos', error);
  for (const f of files || []) {
    if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
    const p = `${folder}/${f.name}`;
    if (!paths.includes(p)) paths.push(p);
  }
  if (paths.length === 0) return [];

  const { data: signed } = await storage.createSignedUrls(paths, 600);
  return paths.map(path => {
    const raw = path.split('/').pop() || path;
    return {
      path,
      name: raw.replace(/^\d+_(\d+_)?/, ''),
      isPdf: raw.toLowerCase().endsWith('.pdf'),
      url: signed?.find(s => s.path === path)?.signedUrl || null
    };
  });
}
