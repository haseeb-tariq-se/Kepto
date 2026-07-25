# Kepto — your digital second brain

Save anything (note, link, image, voice). AI reads it, titles it, and tags it.
Later, ask in plain words — Kepto finds it **by meaning** and tells you why it
matched. Built entirely on free tiers.

## Stack (all free)
- **Next.js 14** (App Router) — UI + API routes
- **Supabase** — auth (email/password) + Postgres + `pgvector`
- **Groq** — `gpt-oss-120b` (text), `qwen/qwen3.6-27b` (vision), `whisper-large-v3` (transcription)
- **Cohere** — `embed-v4.0` embeddings for semantic search

## What's inside
- Single scrolling page: **Workspace → How it Works → About → Contact**, dark
  glassmorphism + neon, and a scroll-reactive neon "neural thread".
- **Auth**: `/login` + `/signup` (email/password via Supabase), and a hidden
  cat on the login button that only peeks out on hover once **both** fields
  are filled.
- **Strict rate limit**: 4 saves/hour/user, enforced server-side via an
  append-only `save_events` table, with a live "N saves remaining this hour"
  counter that updates after every save.
- **Smart URL router**: regex splits standard links vs social links.
  Standard → scrape `<title>` + Open Graph to auto-name. Social → the optional
  `/worker` (yt-dlp → Whisper → vision → title + tags).
- Saved items have **pencil-editable titles** and **custom glowing tags**.

## Setup
1. `npm install`
2. Copy `.env.local.example` → `.env.local` and fill the keys.
3. In Supabase → **SQL Editor**, paste **all** of `supabase/schema.sql` and run it.
4. In Supabase → **Authentication → Providers**, make sure Email is enabled
   (it is by default).
5. `npm run dev` → http://localhost:3000

## Deploy (free)
The app deploys to **Vercel** free. Add the same env vars in the Vercel
dashboard. The social `/worker` cannot run on Vercel (no ffmpeg/yt-dlp) — deploy
it separately on Render or Hugging Face Spaces and set `SOCIAL_WORKER_URL`.

## Honest cost notes (per your requirement)
- **Free with no catch**: Supabase auth, the rate limit, Groq
  Whisper/vision/text, and Cohere's trial embeddings (trial keys are
  rate-limited but free).
- **Two catches, both on the social pipeline only:**
  1. `yt-dlp` + `ffmpeg` need a separate container (Render/HF), not Vercel.
     Free tiers cold-start (~30–60s first hit).
  2. YouTube/Instagram block datacenter IPs. Reliable social extraction
     effectively needs cookies or a **paid residential proxy** — the one part
     of this project that isn't free. Standard links and everything else are
     unaffected. The app ships with the social branch **stubbed**, so nothing
     breaks; set `SOCIAL_WORKER_URL` to switch it on.
