import { createClient } from '@supabase/supabase-js';

// Server-only service-role client (bypasses RLS). Built lazily so the app
// compiles without secrets. All DB access flows through /api routes.
let svc = null;
export function getSupabase() {
  if (!svc) {
    svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return svc;
}

// Verify the caller's Supabase access token (sent as `Authorization: Bearer`).
// Uses the public anon key just to validate the JWT and read the user id.
// Returns the user object, or null if the request isn't authenticated.
let anon = null;
export async function getUserFromRequest(req) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  if (!anon) {
    anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );
  }
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// Strict rate limit: how many saves the user has left this rolling hour.
const LIMIT = 20;
export async function getRemainingSaves(userId) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await getSupabase()
    .from('save_events')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const used = data?.length || 0;
  const remaining = Math.max(0, LIMIT - used);
  // When the oldest save in the window ages out, a slot frees up.
  const resetAt = data?.[0]
    ? new Date(new Date(data[0].created_at).getTime() + 60 * 60 * 1000).toISOString()
    : null;
  return { limit: LIMIT, used, remaining, resetAt };
}
