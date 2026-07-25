import { NextResponse } from 'next/server';
import { getSupabase, getUserFromRequest } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COLS = 'id, type, source, title, content, source_url, ai_description, tags, pinned, image_base64, image_mime, created_at';

export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    const { data, error } = await getSupabase()
      .from('items').select(COLS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(200);
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
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const ids = url.searchParams.get('ids'); // comma-separated for bulk delete
    let q = getSupabase().from('items').delete().eq('user_id', user.id);
    if (ids) q = q.in('id', ids.split(',').filter(Boolean));
    else if (id) q = q.eq('id', id);
    else return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await q;
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Edit title, custom tags, or pinned state. Supports single id or bulk (ids[] + addTag).
export async function PATCH(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    const body = await req.json();
    const { id, ids, title, tags, pinned, addTag } = body;

    // bulk add-a-tag to many items
    if (Array.isArray(ids) && ids.length && typeof addTag === 'string' && addTag.trim()) {
      const tag = addTag.trim().toLowerCase().slice(0, 40);
      const { data: rows } = await getSupabase()
        .from('items').select('id, tags').eq('user_id', user.id).in('id', ids);
      await Promise.all((rows || []).map((r) => {
        const next = Array.from(new Set([...(r.tags || []), tag])).slice(0, 12);
        return getSupabase().from('items').update({ tags: next }).eq('id', r.id).eq('user_id', user.id);
      }));
      return NextResponse.json({ ok: true });
    }

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const patch = {};
    if (typeof title === 'string') patch.title = title.slice(0, 120);
    if (Array.isArray(tags)) patch.tags = tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 12);
    if (typeof pinned === 'boolean') patch.pinned = pinned;
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
