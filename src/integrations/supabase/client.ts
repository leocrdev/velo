import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import type { AppConfig } from '@/lib/config';

let supabaseInstance: SupabaseClient<Database> | null = null;

export function initializeSupabase(config: AppConfig): SupabaseClient<Database> {
  if (supabaseInstance) return supabaseInstance;

  supabaseInstance = createClient<Database>(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );

  return supabaseInstance;
}

export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    throw new Error('Supabase client not initialized. Call initializeSupabase() first.');
  }
  return supabaseInstance;
}

// Backward compatibility - lazy getter
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop) {
    return Reflect.get(getSupabase(), prop);
  },
});

/** @internal Reset supabase instance — for testing only */
export function resetSupabase(): void {
  supabaseInstance = null;
}
