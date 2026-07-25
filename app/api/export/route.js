import { getSupabase, getUserFromRequest } from '../../../lib/supabase';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LABEL = { instagram:'Instagram', tiktok:'TikTok', youtube:'YouTube', snapchat:'Snapchat', x:'X / Twitter', web:'Web link', note:'Note' };

// On-demand XLSX export of the user's saves (Postgres stays the source of truth).
// Optional ?ids=a,b,c to export only selected items.
export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });

    const idsParam = new URL(req.url).searchParams.get('ids');
    let q = getSupabase()
      .from('items')
      .select('title, source, type, ai_description, content, tags, pinned, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (idsParam) q = q.in('id', idsParam.split(',').filter(Boolean));
    const { data, error } = await q;
    if (error) throw error;

    const rows = (data || []).map((it) => ({
      Title: it.title || '',
      Source: LABEL[it.source] || 'Note',
      Type: it.type || '',
      Description: it.ai_description || '',
      Content: it.content || '',
      Tags: (it.tags || []).join(', '),
      Pinned: it.pinned ? 'yes' : '',
      Saved: it.created_at ? new Date(it.created_at).toLocaleString() : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 40 }, { wch: 40 }, { wch: 24 }, { wch: 8 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kepto Saves');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const name = `kepto-saves-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
