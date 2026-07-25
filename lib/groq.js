const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = process.env.GROQ_API_KEY;

const CHAT_MODEL   = 'openai/gpt-oss-120b';    // free tier, text-only
const VISION_MODEL = 'qwen/qwen3.6-27b';        // free tier, supports images

const COHERE_API = 'https://api.cohere.com/v2/embed';
const COHERE_KEY = process.env.COHERE_API_KEY;
const EMBED_MODEL = 'embed-v4.0';
const EMBED_DIMS = 1024; // Cohere only offers 256/512/1024/1536 — schema.sql uses vector(1024)

async function callGroq(body) {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY missing in .env.local');
  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    let msg = detail;
    try { msg = JSON.parse(detail)?.error?.message || detail; } catch {}
    throw new Error(`Groq ${res.status}: ${msg}`.slice(0, 400));
  }
  return res.json();
}

async function generate(prompt, imageParts) {
  const content = [{ type: 'text', text: prompt }];
  if (imageParts?.length) content.push(...imageParts);
  const data = await callGroq({
    model: imageParts?.length ? VISION_MODEL : CHAT_MODEL,
    messages: [{ role: 'user', content }],
    temperature: 0.3,
  });
  return data?.choices?.[0]?.message?.content ?? '';
}

// inputType: 'search_document' when embedding saved items, 'search_query' when embedding a search query
export async function embed(text, inputType = 'search_document') {
  if (!COHERE_KEY) throw new Error('COHERE_API_KEY missing in .env.local');
  const res = await fetch(COHERE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${COHERE_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      texts: [text.slice(0, 8000)],
      input_type: inputType,
      embedding_types: ['float'],
      output_dimension: EMBED_DIMS,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    let msg = detail;
    try { msg = JSON.parse(detail)?.message || detail; } catch {}
    throw new Error(`Cohere ${res.status}: ${msg}`.slice(0, 400));
  }
  const data = await res.json();
  return data?.embeddings?.float?.[0] ?? null;
}

function safeJson(text, fallback) {
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
  catch { return fallback; }
}

// imageBase64 and imageMime are optional — pass them when saving an image
export async function enrich(content, imageBase64, imageMime) {
  const imageParts = imageBase64
    ? [{ type: 'image_url', image_url: { url: `data:${imageMime || 'image/jpeg'};base64,${imageBase64}` } }]
    : null;
  const prompt = `You are Kepto, a digital second brain. A user just saved this:
"""${content.slice(0, 3000)}"""
${imageBase64 ? 'An image is also attached — describe what you see in it too.' : ''}
Respond with a JSON object ONLY:
- "title": a short, catchy title, max 6 words.
- "description": one clear sentence max 25 words.
- "tags": 3 short lowercase tags, no # symbol.
No preamble, no markdown fences.`;
  const parsed = safeJson(await generate(prompt, imageParts), { title: '', description: '', tags: [] });
  return {
    title: parsed.title || '',
    description: parsed.description || '',
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
  };
}

// Given a social video's transcript + visual description, write a catchy
// title and 3 tags (used by the smart-URL social pipeline).
export async function titleFromMedia(transcript, visual) {
  const prompt = `A user saved a social video.
Transcript: """${(transcript || '').slice(0, 3000)}"""
Visual description of a frame: """${(visual || '').slice(0, 800)}"""
Respond with JSON ONLY:
- "title": a concise, catchy title, max 8 words.
- "description": one sentence, max 25 words.
- "tags": exactly 3 short lowercase tags, no # symbol.
No preamble, no fences.`;
  const parsed = safeJson(await generate(prompt), { title: '', description: '', tags: [] });
  return {
    title: parsed.title || 'Social video',
    description: parsed.description || '',
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : ['social', 'video'],
  };
}

export async function explainMatches(query, items) {
  if (!items.length) return {};
  const list = items
    .map((it, i) => `${i}. ${it.ai_description || it.content.slice(0, 100)} [tags: ${(it.tags || []).join(', ')}]`)
    .join('\n');
  const prompt = `User asked: "${query}"
Items:
${list}
For each item write one short reason (max 15 words) why it matches.
Return ONLY JSON like {"0":"...","1":"..."}. No fences.`;
  return safeJson(await generate(prompt), {});
}
