import { NextResponse } from 'next/server';
import { getSupabase, getUserFromRequest } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COLS = 'id, type, title, content, source_url, ai_description, tags, image_base64, image_mime, created_at';

export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    const { data, error } = await getSupabase()
      .from('items').select(COLS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await getSupabase()
      .from('items').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Edit a saved note's title (pencil icon) and/or its custom tags.
export async function PATCH(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    const { id, title, tags } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const patch = {};
    if (typeof title === 'string') patch.title = title.slice(0, 120);
    if (Array.isArray(tags)) patch.tags = tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 12);
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    const { data, error } = await getSupabase()
      .from('items').update(patch).eq('id', id).eq('user_id', user.id)
      .select(COLS).single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
