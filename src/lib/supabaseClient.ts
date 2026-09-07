import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Credentials come from .env (see .env.example) and point at the NCF Predict
// Supabase project (https://crldynueekbzdirietkq.supabase.co). No localStorage
// override and no mock fallback here — this always talks to that one project.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseLiveConfigured = (): boolean => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
};

if (!isSupabaseLiveConfigured()) {
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
    'Copy .env.example to .env and fill them in to connect to Supabase.'
  );
}

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      SUPABASE_URL || 'https://placeholder.invalid',
      SUPABASE_ANON_KEY || 'placeholder-anon-key',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    );
  }
  return supabaseInstance;
};

// A fresh, throwaway client with no persisted session — used only for
// "an already-logged-in staff member creates a new account for someone
// else" (calling supabase.auth.signUp on the shared singleton client would
// replace the caller's own session with the new user's).
export const getIsolatedSupabase = (): SupabaseClient => {
  return createClient(
    SUPABASE_URL || 'https://placeholder.invalid',
    SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
};
