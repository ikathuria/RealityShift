import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabase(url: string, serviceKey: string): SupabaseClient {
  if (!_client) {
    _client = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
