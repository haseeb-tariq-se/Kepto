# Kepto — your digital second brain

Save anything (note, link, image, voice). AI reads it, titles it, tags it.
Later, ask in plain words — Kepto finds it **by meaning** and tells you why it
matched. Built entirely on free tiers.

## Stack (all free)
- **Next.js 14** (App Router) — UI + API routes
- **Supabase** — auth (email/password) + Postgres + `pgvector`
- **Groq** — `gpt-oss-120b` (text), `qwen/qwen3.6-27b` (vision), `whisper-large-v3` (transcription)
- **Cohere** — `embed-v4.0` embeddings for semantic search
- **SheetJS (xlsx)** — on-demand Excel export

## Features
- Single scrolling page: **Workspace → How it Works → About → Contact**, dark
  glassmorphism + neon, a scroll-reactive neon "neural thread", and a Kepto logo
  that jumps + flashes a glowing underline every 4s.
- **Auth**: `/login` + `/signup` (email/password), **forgot-password**,
  show/hide password, Caps-Lock warning, and a walking-cat micro-interaction on
  the login button (only when both fields are filled).
- **7 saves/hour/user**, enforced server-side, with a live counter.
- **Smart URL router**: standard links → scrape `<title>` + Open Graph; social
  links → optional `/worker` (yt-dlp → Whisper → vision → title/tags).
- **Your saves**: shows 3 with a **Show more** expander; **sort** by date,
  **filter by source** (Instagram/TikTok/YouTube/Snapchat/X/Web/Note) with live
  counts, **tag-filter chips**, **pin-to-top**, editable titles, custom glowing
  tags, live "saved X ago" timestamps, **copy**, and **multi-select** for bulk
  **tag / export / delete** (with confirm).
- **Duplicate detection** — warns before saving a URL you already saved.
- **Export to Excel** — download all (or selected) saves as `.xlsx`, generated
  on demand from Postgres (the source of truth).
- Favicon + Open Graph / Twitter card metadata.

## Setup
1. `npm install`
2. Copy `.env.local.example` → `.env.local` and fill the keys.
3. In Supabase → **SQL Editor**, paste **all** of `supabase/schema.sql` and run it.
4. In Supabase → **Authentication → Providers**, make sure Email is enabled.
5. **Fix email links (important — do this or confirmation emails break):**
   Supabase → **Authentication → URL Configuration** → set **Site URL** to your
   real app URL (your deployed URL, or your PC's LAN IP like
   `http://192.168.1.5:3000` for phone testing — NOT `localhost`, which on a
   phone points at the phone itself). Add that same URL (with `/**`) under
   **Redirect URLs**. No trailing slash.
6. **Avoid "email rate limit exceeded":** Supabase's built-in email sender is
   capped very low. Supabase → **Authentication → SMTP Settings** → enable
   **Custom SMTP** with a free provider (Resend: 3,000/mo, or Brevo: 300/day).
7. `npm run dev` → http://localhost:3000

## Deploy (free)
Deploy to **Vercel** free; add the same env vars in the dashboard. After
deploying, set the Supabase **Site URL / Redirect URLs** (step 5) to your live
Vercel URL. The social `/worker` can't run on Vercel — deploy it separately on
Render/HF and set `SOCIAL_WORKER_URL`.

## Honest cost notes
- **Free, no catch**: Supabase auth, rate limit, Groq (Whisper/vision/text),
  Cohere trial embeddings, Excel export, contact capture.
- **The one catch**: reliable social-video extraction (yt-dlp) needs a separate
  free container AND, for YouTube/Instagram, effectively a paid residential
  proxy. The app ships with that branch **stubbed** so nothing breaks; set
  `SOCIAL_WORKER_URL` to switch it on.
