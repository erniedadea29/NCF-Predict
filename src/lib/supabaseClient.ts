import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safe retrieval of credentials from environment or localStorage
const getSupabaseConfig = () => {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  
  const savedUrl = typeof window !== 'undefined' ? localStorage.getItem('ncf_supabase_url') : null;
  const savedKey = typeof window !== 'undefined' ? localStorage.getItem('ncf_supabase_key') : null;

  return {
    url: savedUrl || envUrl || 'https://mock-ncf-predict.supabase.co',
    key: savedKey || envKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-key',
    isConfigured: Boolean((savedUrl || envUrl) && (savedKey || envKey))
  };
};

export const isSupabaseLiveConfigured = (): boolean => {
  const { isConfigured, url } = getSupabaseConfig();
  return isConfigured && !url.includes('mock-ncf-predict');
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    const { url, key } = getSupabaseConfig();
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      });
    } catch {
      supabaseInstance = createClient('https://mock-ncf-predict.supabase.co', 'mock-key');
    }
  }
  return supabaseInstance;
};

export const updateSupabaseCredentials = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ncf_supabase_url', url);
    localStorage.setItem('ncf_supabase_key', key);
    try {
      supabaseInstance = createClient(url, key);
    } catch (e) {
      console.error('Failed to initialize Supabase client with new credentials', e);
    }
  }
};
