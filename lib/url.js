// Detects whether a submitted URL is a social-media video link or a standard
// web link, and lightly scrapes standard links for a title + OG metadata.

const SOCIAL_RE = /(?:^|\/\/|\.)(instagram\.com|instagr\.am|tiktok\.com|youtube\.com|youtu\.be|(?:x|twitter)\.com)\b/i;
const URL_RE = /^https?:\/\/\S+$/i;

export function isUrl(text = '') {
  return URL_RE.test(text.trim());
}

// Returns 'social' | 'standard' | null
export function classifyUrl(text = '') {
  const t = text.trim();
  if (!isUrl(t)) return null;
  return SOCIAL_RE.test(t) ? 'social' : 'standard';
}

function pick(html, re) {
  const m = html.match(re);
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
}

function decode(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

// Lightweight scrape of <title> + Open Graph tags to auto-name a saved link.
export async function scrapeStandard(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; KeptoBot/1.0; +https://kepto.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    const html = (await res.text()).slice(0, 200_000); // only need the <head>
    const ogTitle = pick(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const ogDesc  = pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const ogImage = pick(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    const tag     = pick(html, /<title[^>]*>([^<]+)<\/title>/i);
    return {
      title: decode(ogTitle || tag) || null,
      description: decode(ogDesc) || null,
      image: ogImage || null,
    };
  } catch {
    return { title: null, description: null, image: null };
  }
}

// Social branch. If SOCIAL_WORKER_URL is set we call the Python worker
// (yt-dlp -> Whisper -> vision -> title/tags). Otherwise we return a clean
// stub so the app keeps working and the router stays wired.
export async function analyzeSocial(url) {
  const worker = process.env.SOCIAL_WORKER_URL;
  if (!worker) {
    return {
      stub: true,
      title: 'Social video saved',
      description:
        'Deep video analysis (transcript + visual read) is not connected yet. ' +
        'Deploy the extractor worker and set SOCIAL_WORKER_URL to enable it.',
      tags: ['social', 'video', 'unprocessed'],
      transcript: null,
      image: null,
    };
  }
  try {
    const res = await fetch(`${worker.replace(/\/$/, '')}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`worker ${res.status}`);
    return { stub: false, ...(await res.json()) };
  } catch (e) {
    return {
      stub: true,
      title: 'Social video saved',
      description: `Couldn't reach the extractor worker (${e.message}). Saved the link anyway.`,
      tags: ['social', 'video'],
      transcript: null,
      image: null,
    };
  }
}
