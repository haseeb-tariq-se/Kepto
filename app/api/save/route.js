import { NextResponse } from 'next/server';
import { getSupabase, getUserFromRequest, getRemainingSaves } from '../../../lib/supabase';
import { enrich, embed, titleFromMedia } from '../../../lib/groq';
import { classifyUrl, scrapeStandard, analyzeSocial } from '../../../lib/url';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  try {
    // --- auth ---
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Please sign in to save.' }, { status: 401 });

    // --- STRICT rate limit: 4 saves / rolling hour ---
    const usage = await getRemainingSaves(user.id);
    if (usage.remaining <= 0) {
      return NextResponse.json(
        { error: "You've hit your 4 saves for this hour. A slot frees up soon.", usage },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { content, type = 'note', imageBase64 = null, imageMime = null } = body;
    const raw = (content || '').trim();
    if (!raw && !imageBase64) {
      return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
    }

    // --- Smart URL router ---
    let title = null, description = null, tags = [];
    let finalType = imageBase64 ? 'image' : type;
    let source_url = null;
    let text = raw || (imageBase64 ? '[image]' : '');

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
      // plain note / image — AI reads it (and the image, if any)
      const ai = await enrich(text, imageBase64, imageMime);
      title = ai.title; description = ai.description; tags = ai.tags;
    }

    // --- Embed for semantic search ---
    const embedding = await embed(`${title || ''}\n${text}\n${description || ''}`);

    // --- Store (scoped to this user) ---
    const { data, error } = await getSupabase()
      .from('items')
      .insert({
        user_id: user.id,
        content: text,
        type: finalType,
        title,
        source_url,
        ai_description: description,
        tags,
        embedding,
        image_base64: imageBase64 || null,
        image_mime: imageMime || null,
      })
      .select('id, type, title, content, source_url, ai_description, tags, image_base64, image_mime, created_at')
      .single();
    if (error) throw error;

    // --- Record the save event, then report fresh remaining count ---
    await getSupabase().from('save_events').insert({ user_id: user.id });
    const after = await getRemainingSaves(user.id);

    return NextResponse.json({ item: data, usage: after });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
