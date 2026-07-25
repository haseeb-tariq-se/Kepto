'use client';
import { createClient } from '@supabase/supabase-js';

// Browser client — used ONLY for auth (login/signup/Google/session).
// The database is never touched from here; saves/searches go through /api.
let client = null;
export function getBrowserSupabase() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return client;
}
