"""
Kepto social-video extractor worker (OPTIONAL).

Turns an Instagram / TikTok / YouTube / X link into a transcript + a visual
description, using ONLY free tools:
  yt-dlp      -> pull the audio track + one thumbnail frame
  Groq Whisper (whisper-large-v3)      -> speech-to-text transcript
  Groq Vision  (qwen/qwen3.6-27b)      -> describe the thumbnail frame

The Next.js app calls POST /analyze { "url": "..." } and gets back
  { "transcript": "...", "description": "<visual>", "image": "<b64|null>" }
The app then writes the catchy title + 3 tags itself.

Deploy free on Render (Docker web service) or Hugging Face Spaces.
Heads-up (see README): social sites often block datacenter IPs, so this
will fail intermittently unless you add cookies or a residential proxy.
"""
import os, base64, tempfile, subprocess, glob
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

GROQ_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ = "https://api.groq.com/openai/v1"
WHISPER_MODEL = "whisper-large-v3"
VISION_MODEL = "qwen/qwen3.6-27b"

app = FastAPI()

class In(BaseModel):
    url: str

def run(cmd):
    subprocess.run(cmd, check=True, capture_output=True, timeout=90)

@app.get("/")
def health():
    return {"ok": True, "service": "kepto-social-worker"}

@app.post("/analyze")
def analyze(body: In):
    if not GROQ_KEY:
        raise HTTPException(500, "GROQ_API_KEY not set on the worker")
    with tempfile.TemporaryDirectory() as d:
        audio = os.path.join(d, "a.mp3")
        # 1) audio track (needs ffmpeg on the box)
        try:
            run(["yt-dlp", "-x", "--audio-format", "mp3", "-o", audio, body.url])
        except Exception as e:
            raise HTTPException(502, f"yt-dlp audio failed (site likely blocked the IP): {e}")
        # 2) a thumbnail frame
        try:
            run(["yt-dlp", "--write-thumbnail", "--skip-download",
                 "-o", os.path.join(d, "t.%(ext)s"), body.url])
        except Exception:
            pass
        thumbs = glob.glob(os.path.join(d, "t.*"))

        # 3) transcript via Whisper
        transcript = ""
        with open(audio, "rb") as f:
            r = requests.post(
                f"{GROQ}/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_KEY}"},
                files={"file": ("a.mp3", f, "audio/mpeg")},
                data={"model": WHISPER_MODEL, "response_format": "text"},
                timeout=120,
            )
        if r.ok:
            transcript = r.text.strip()

        # 4) visual description via Groq vision
        visual, img_b64 = "", None
        if thumbs:
            with open(thumbs[0], "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode()
            r = requests.post(
                f"{GROQ}/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"},
                json={
                    "model": VISION_MODEL,
                    "messages": [{"role": "user", "content": [
                        {"type": "text", "text": "Describe this video thumbnail in one clear sentence."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
                    ]}],
                    "temperature": 0.3,
                },
                timeout=60,
            )
            if r.ok:
                visual = r.json()["choices"][0]["message"]["content"].strip()

        return {"transcript": transcript, "description": visual, "image": img_b64}
