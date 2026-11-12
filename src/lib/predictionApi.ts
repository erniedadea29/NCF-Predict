/**
 * Client for the trained-model prediction API (TRAIN_MODEL/api.py).
 *
 * The API loads the active Random Forest (best_model.h5) and, for a budget
 * request, predicts every line item's cost, compares it with the requested
 * amount and saves the result to Supabase (table budget_predictions).
 *
 * Set VITE_PREDICT_API_URL to the deployed API (must be https when the site
 * is served over https). Defaults to a locally running API.
 */
export const PREDICT_API_URL: string =
  (import.meta.env.VITE_PREDICT_API_URL as string | undefined)?.replace(/\/+$/, '') || 'http://127.0.0.1:8000';

export interface PredictionApiHealth {
  status: string;
  model_source: string;
  model_id: number | null;
  algorithm: string;
  metrics: Record<string, number>;
  warning: string | null;
}

async function call<T>(path: string, init?: RequestInit, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${PREDICT_API_URL}${path}`, { ...init, signal: controller.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { detail?: string }).detail || `Prediction API error ${res.status}`);
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Which model the API has loaded; throws if the API is unreachable. */
export function getPredictionApiHealth(): Promise<PredictionApiHealth> {
  return call<PredictionApiHealth>('/health', undefined, 8000);
}

/**
 * Predicts every item of a budget request and saves the results to Supabase
 * (re-running replaces the previous prediction for that request).
 */
export function predictBudgetRequest(requestId: string): Promise<{ saved: boolean; save_error: string | null; predicted_total: number }> {
  return call(`/predict/request/${encodeURIComponent(requestId)}`, { method: 'POST' });
}
