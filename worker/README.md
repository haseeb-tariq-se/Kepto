# Kepto social-video worker (optional, free)

The main Kepto app works without this. When you deploy it and set
`SOCIAL_WORKER_URL` in the app's env, links from Instagram / TikTok /
YouTube / X get a real transcript + visual read instead of the stub.

## Contract
`POST /analyze  { "url": "..." }` →
`{ "transcript": "...", "description": "<visual sentence>", "image": "<base64|null>" }`
The app turns that into a catchy title + 3 tags via Groq.

## Deploy free (Render, Docker)
1. Push `/worker` to a repo.
2. Render → New → Web Service → Docker → point at this folder.
3. Set env `GROQ_API_KEY`. Free instances sleep when idle (first call is slow).
4. Copy the URL into the app's `SOCIAL_WORKER_URL`.

## Reality check
YouTube and Instagram frequently block cloud/datacenter IPs
("confirm you're not a bot" / login required). To make it reliable you'll
need to pass cookies (`--cookies`) or a residential proxy — the proxy is the
only piece here that isn't free. Everything else (Groq Whisper + vision) is
on Groq's free tier.
