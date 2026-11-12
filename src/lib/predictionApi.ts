/**
 * Client for the trained-model prediction API (TRAIN_MODEL/api.py).
 *
 * The API loads the active Random Forest (best_model.h5) and, for a budget
 * request, predicts every line item's cost, compares it with the requested
 * amount and saves the result to Supabase (table budget_predictions).
 *
 * Set VITE_PREDICT_API_URL to the deployed API's https URL on the hosting
 * service BEFORE building (Vite bakes VITE_ variables in at build time).
 * Only local development (`npm run dev`) falls back to a locally running API;
 * a deployed site never points at localhost.
 */
const configured = (import.meta.env.VITE_PREDICT_API_URL as string | undefined)?.trim().replace(/\/+$/, '');
export const PREDICT_API_URL: string = configured || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

/** Why predictions can't be requested at all, or null if the API URL looks usable. */
export function predictionApiConfigProblem(): string | null {
  if (!PREDICT_API_URL) {
    return 'The prediction API address is not set. On the hosting service, add VITE_PREDICT_API_URL '
      + '(the https URL of the deployed TRAIN_MODEL API), then redeploy the website.';
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && PREDICT_API_URL.startsWith('http:')) {
    return `This site is served over https, so the browser blocks the http prediction API (${PREDICT_API_URL}). `
      + 'Set VITE_PREDICT_API_URL to the API\'s https URL, then redeploy the website.';
  }
  return null;
}

export interface PredictionApiHealth {
  status: string;
  model_source: string;
  model_id: number | null;
  algorithm: string;
  metrics: Record<string, number>;
  warning: string | null;
}

async function call<T>(path: string, init?: RequestInit, timeoutMs = 30000): Promise<T> {
  const problem = predictionApiConfigProblem();
  if (problem) throw new Error(problem);
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
  // A sleeping free-tier server can take ~1 minute to wake up.
  return call<PredictionApiHealth>('/health', undefined, 60000);
}

/**
 * Predicts every item of a budget request and saves the results to Supabase
 * (re-running replaces the previous prediction for that request).
 */
export function predictBudgetRequest(requestId: string): Promise<{ saved: boolean; save_error: string | null; predicted_total: number }> {
  // Allow time for a sleeping free-tier server to wake up.
  return call(`/predict/request/${encodeURIComponent(requestId)}`, { method: 'POST' }, 90000);
}
