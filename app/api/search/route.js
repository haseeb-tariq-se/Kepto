import { NextResponse } from 'next/server';
import { getSupabase, getUserFromRequest } from '../../../lib/supabase';
import { embed, explainMatches } from '../../../lib/groq';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Please sign in to search.' }, { status: 401 });
    const { query } = await req.json();
    if (!query || !query.trim()) return NextResponse.json({ items: [] });

    const queryEmbedding = await embed(query, 'search_query');
    const { data, error } = await getSupabase().rpc('match_items', {
      p_user_id: user.id,
      query_embedding: queryEmbedding,
      match_count: 6,
    });
    if (error) throw error;

    const reasons = await explainMatches(query, data || []);
    const items = (data || []).map((it, i) => ({ ...it, why: reasons[String(i)] || null }));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
