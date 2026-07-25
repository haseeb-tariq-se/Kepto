import { NextResponse } from 'next/server';
import { getSupabase, getUserFromRequest, getRemainingSaves } from '../../../lib/supabase';
import { enrich, embed, titleFromMedia } from '../../../lib/groq';
import { classifyUrl, scrapeStandard, analyzeSocial, detectSource, normalizeUrl, isUrl } from '../../../lib/url';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COLS = 'id, type, source, title, content, source_url, ai_description, tags, pinned, image_base64, image_mime, created_at';
const MAX_LEN = 5000;

export async function POST(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Please sign in to save.' }, { status: 401 });

    const body = await req.json();
    const { content, type = 'note', imageBase64 = null, imageMime = null, force = false } = body;
    const raw = (content || '').trim();
    if (!raw && !imageBase64) {
      return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
    }
    // --- input validation ---
    if (raw.length > MAX_LEN) {
      return NextResponse.json({ error: `Too long — ${MAX_LEN} character max.` }, { status: 400 });
    }

    // --- duplicate URL detection (unless user forces) ---
    if (!force && isUrl(raw)) {
      const norm = normalizeUrl(raw);
      const { data: existing } = await getSupabase()
        .from('items').select('id, title, source_url')
        .eq('user_id', user.id).not('source_url', 'is', null).limit(500);
      const dupe = (existing || []).find((it) => normalizeUrl(it.source_url || '') === norm);
      if (dupe) {
        return NextResponse.json(
          { duplicate: true, error: `You already saved this link ("${dupe.title || 'untitled'}").` },
          { status: 409 }
        );
      }
    }

    // --- STRICT rate limit: 7 saves / rolling hour ---
    const usage = await getRemainingSaves(user.id);
    if (usage.remaining <= 0) {
      return NextResponse.json(
        { error: "You've hit your 7 saves for this hour. A slot frees up soon.", usage },
        { status: 429 }
      );
    }

    // --- Smart URL router ---
    let title = null, description = null, tags = [];
    let finalType = imageBase64 ? 'image' : type;
    let source_url = null;
    let text = raw || (imageBase64 ? '[image]' : '');
    const source = detectSource(raw); // instagram|tiktok|youtube|snapchat|x|web|note

    const kind = classifyUrl(raw); // 'social' | 'standard' | null
    if (kind === 'standard') {
      source_url = raw; finalType = 'link';
      const meta = await scrapeStandard(raw);
      title = meta.title;
      const basis = [meta.title, meta.description].filter(Boolean).join('. ') || raw;
      const ai = await enrich(basis);
      description = meta.description || ai.description;
      tags = ai.tags;
      text = raw;
    } else if (kind === 'social') {
      source_url = raw; finalType = 'social';
      const media = await analyzeSocial(raw);
      if (media.stub) {
        title = media.title; description = media.description; tags = media.tags;
      } else {
        const t = await titleFromMedia(media.transcript, media.description);
        title = t.title; description = t.description; tags = t.tags;
        if (media.transcript) text = media.transcript;
      }
    } else {
      const ai = await enrich(text, imageBase64, imageMime);
      title = ai.title; description = ai.description; tags = ai.tags;
    }

    const embedding = await embed(`${title || ''}\n${text}\n${description || ''}`);

    const { data, error } = await getSupabase()
      .from('items')
      .insert({
        user_id: user.id,
        content: text,
        type: finalType,
        source,
        title,
        source_url,
        ai_description: description,
        tags,
        pinned: false,
        embedding,
        image_base64: imageBase64 || null,
        image_mime: imageMime || null,
      })
      .select(COLS)
      .single();
    if (error) throw error;

    await getSupabase().from('save_events').insert({ user_id: user.id });
    const after = await getRemainingSaves(user.id);

    return NextResponse.json({ item: data, usage: after });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
