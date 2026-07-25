'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getBrowserSupabase } from '../lib/supabase-browser';

/* ---------- tiny icons ---------- */
function MicIcon() {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/></svg>);
}
function ImageIcon() {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>);
}
function PencilIcon() {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>);
}

/* ---------- voice helpers ---------- */
function useSpeech() {
  const recRef = useRef(null);
  const start = (onResult, onEnd) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice works best in Chrome.'); onEnd?.(); return; }
    const rec = new SR();
    rec.lang = 'en-US'; rec.interimResults = false;
    rec.onresult = (e) => onResult(e.results[0][0].transcript);
    rec.onend = () => onEnd?.(); rec.onerror = () => onEnd?.();
    recRef.current = rec; rec.start();
  };
  const stop = () => recRef.current?.stop();
  return { start, stop };
}
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

/* ---------- a saved item, with pencil-edit title + custom glowing tags ---------- */
function ItemCard({ it, index, deleting, onDelete, onSaveTitle, onAddTag, onRemoveTag, highlight }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(it.title || '');
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const heading = it.title || it.ai_description || 'Saved item';

  function commitTitle() { setEditing(false); const v = draft.trim(); if (v && v !== it.title) onSaveTitle(it.id, v); }
  function commitTag() { const v = newTag.trim(); if (v) onAddTag(it, v); setNewTag(''); setAdding(false); }

  return (
    <div className={`result glass${highlight ? ' result-top' : ''}${deleting ? ' result-leaving' : ''}`}
         style={{ animationDelay: `${index * 60}ms` }}>
      <button className="result-del" title="Delete" onClick={() => onDelete(it.id)}>✕</button>

      {it.image_base64 && (
        <img src={`data:${it.image_mime};base64,${it.image_base64}`} alt=""
             style={{ width: '100%', borderRadius: 12, marginBottom: 12, maxHeight: 200, objectFit: 'cover' }} />
      )}

      <div className="result-head">
        {editing ? (
          <input className="title-edit" value={draft} autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditing(false); }} />
        ) : (
          <h4 className="result-title">{heading}</h4>
        )}
        <button className="pencil" title="Edit title" onClick={() => { setDraft(it.title || heading); setEditing(true); }}>
          <PencilIcon />
        </button>
      </div>

      {it.title && it.ai_description && it.ai_description !== it.title && (
        <p className="result-desc-sub">{it.ai_description}</p>
      )}
      {it.why && <div className="why"><span>✦</span> Matched because {it.why}</div>}

      <p className="result-content">
        {it.source_url
          ? <a href={it.source_url} target="_blank" rel="noreferrer">{it.source_url}</a>
          : it.content !== '[image]' ? it.content : null}
      </p>

      <div className="tags">
        {(it.tags || []).map((t) => (
          <span className="tag tag-glow" key={t}>
            {t}<button className="tag-x" title="Remove tag" onClick={() => onRemoveTag(it, t)}>×</button>
          </span>
        ))}
        {adding ? (
          <input className="tag-input" value={newTag} autoFocus placeholder="tag…"
            onChange={(e) => setNewTag(e.target.value)}
            onBlur={commitTag}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTag(); if (e.key === 'Escape') setAdding(false); }} />
        ) : (
          <button className="tag-add" onClick={() => setAdding(true)}>+ tag</button>
        )}
      </div>

      {it.created_at && <p className="hint" style={{ marginTop: 10 }}>{new Date(it.created_at).toLocaleString()}</p>}
    </div>
  );
}

/* ---------- the "N saves remaining this hour" counter ---------- */
function SaveCounter({ usage }) {
  if (!usage) return null;
  const { remaining, limit, resetAt } = usage;
  const dots = Array.from({ length: limit });
  const reset = resetAt ? new Date(resetAt) : null;
  return (
    <div className={`counter glass${remaining === 0 ? ' counter-empty' : ''}`}>
      <div className="counter-dots">
        {dots.map((_, i) => <span key={i} className={`cdot${i < remaining ? ' on' : ''}`} />)}
      </div>
      <div className="counter-text">
        {remaining > 0
          ? <><strong>{remaining}</strong> {remaining === 1 ? 'save' : 'saves'} remaining this hour</>
          : <>Hourly limit reached{reset ? ` — resets ${reset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</>}
      </div>
    </div>
  );
}

const STEPS = [
  { num: 1, active: false, title: 'Save anything, instantly', body: 'Drop in a note, a link, an image, or a quick voice memo. No folders, no manual tags — just save and move on.' },
  { num: 2, active: false, title: 'Let AI understand it', body: "The moment you save, Kepto reads it in the background and writes a smart title, description, and tags. You never organize anything." },
  { num: 3, active: false, title: 'Forget it, on purpose', body: "That's the point. Save it and get on with your day. Kepto remembers so you don't have to." },
  { num: 4, active: true, title: 'Ask, whenever', body: 'Weeks later, type a rough description or just talk out loud — "that dark UI link I saved" — and Kepto searches by meaning, not filename.' },
  { num: 5, active: false, title: 'Get it back, instantly', body: "Kepto returns the exact item, tells you why it matched, and reads it back aloud on voice. From forgotten to found." },
];

/* ---------- signature element: a glowing neural thread that bends with scroll ---------- */
function ScrollThread() {
  const [d, setD] = useState('');
  const raf = useRef(0);
  const build = useCallback(() => {
    const w = window.innerWidth, h = window.innerHeight;
    const doc = document.documentElement;
    const prog = doc.scrollHeight > h ? window.scrollY / (doc.scrollHeight - h) : 0;
    const cx = w * 0.5;
    const amp = Math.min(w * 0.22, 240);
    const N = 6;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      // horizontal bend shifts as you scroll -> the thread "flows" and re-curves
      const x = cx + amp * Math.sin(t * Math.PI * 2.2 + prog * Math.PI * 2);
      const y = t * h;
      pts.push([x, y]);
    }
    // smooth cubic path through the points
    let path = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const my = (y0 + y1) / 2;
      path += ` C ${x0.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    setD(path);
  }, []);
  useEffect(() => {
    const onScroll = () => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(build); };
    build();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', build);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', build); cancelAnimationFrame(raf.current); };
  }, [build]);
  return (
    <svg className="thread" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="threadg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" /><stop offset="55%" stopColor="#ff7a3d" /><stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <path d={d} className="thread-glow" />
      <path d={d} className="thread-core" stroke="url(#threadg)" />
    </svg>
  );
}

export default function Home() {
  const supabase = getBrowserSupabase();
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [note, setNote] = useState('');
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [usage, setUsage] = useState(null);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [searchErr, setSearchErr] = useState('');

  const [micNote, setMicNote] = useState(false);
  const [micAsk, setMicAsk] = useState(false);
  const speechNote = useSpeech();
  const speechAsk = useSpeech();
  const fileRef = useRef(null);
  const saveRef = useRef(null);

  const [recent, setRecent] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [contactEmail, setContactEmail] = useState('');
  const [contactSent, setContactSent] = useState(false);

  const token = session?.access_token;
  const authHeaders = useCallback(
    (extra = {}) => (token ? { ...extra, Authorization: `Bearer ${token}` } : extra),
    [token]
  );

  // --- session ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const loadHistory = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/items', { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setRecent(data.items.slice(0, 8));
    } catch {}
  }, [token, authHeaders]);

  const loadUsage = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/usage', { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setUsage(data.usage);
    } catch {}
  }, [token, authHeaders]);

  useEffect(() => { if (token) { loadHistory(); loadUsage(); } }, [token, loadHistory, loadUsage]);

  // --- scroll reveal for step cards ---
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach((c, i) => { c.style.transitionDelay = `${(i % 5) * 70}ms`; io.observe(c); });
    return () => io.disconnect();
  }, [authReady]);

  function scrollTo(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
  function enterWorkspace() {
    if (!token) { window.location.href = '/login'; return; }
    scrollTo('save-box');
    setTimeout(() => saveRef.current?.focus(), 400);
  }

  function handleImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setImage({ base64: e.target.result.split(',')[1], mime: file.type, preview: e.target.result });
    reader.readAsDataURL(file);
  }

  async function save() {
    if ((!note.trim() && !image) || saving) return;
    setSaving(true); setSaveErr(''); setSavedMsg('');
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content: note.trim() || '[image]', imageBase64: image?.base64 || null, imageMime: image?.mime || null }),
      });
      const data = await res.json();
      if (res.status === 429) { setUsage(data.usage); setSaveErr(data.error); return; }
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setNote(''); setImage(null);
      setSavedMsg(`Saved — ${data.item.title || (data.item.tags || []).join(', ')}`);
      if (data.usage) setUsage(data.usage);
      loadHistory();
    } catch (e) { setSaveErr(e.message); }
    finally { setSaving(false); }
  }

  async function ask() {
    if (!query.trim() || searching) return;
    setSearching(true); setSearchErr(''); setResults(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.items);
      const top = data.items?.[0];
      if (top) speak(`${top.title || top.ai_description || top.content}. ${top.why || ''}`);
    } catch (e) { setSearchErr(e.message); }
    finally { setSearching(false); }
  }

  async function removeItem(id) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/items?id=${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
      setTimeout(() => {
        setRecent((r) => r?.filter((it) => it.id !== id) ?? r);
        setResults((r) => r?.filter((it) => it.id !== id) ?? r);
        setDeletingId(null);
      }, 220);
    } catch (e) { setDeletingId(null); alert(e.message); }
  }

  function applyPatch(updated) {
    const map = (list) => list?.map((it) => (it.id === updated.id ? updated : it)) ?? list;
    setRecent(map); setResults(map);
  }
  async function patchItem(id, body) {
    const res = await fetch('/api/items', {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, ...body }),
    });
    const data = await res.json();
    if (res.ok) applyPatch(data.item);
  }
  const saveTitle = (id, title) => patchItem(id, { title });
  const addTag = (it, tag) => { const t = tag.toLowerCase(); if (!(it.tags || []).includes(t)) patchItem(it.id, { tags: [...(it.tags || []), t] }); };
  const removeTag = (it, tag) => patchItem(it.id, { tags: (it.tags || []).filter((x) => x !== tag) });

  function submitContact() {
    if (!contactEmail.trim()) return;
    // Front-end only for now — no backend endpoint wired up yet.
    setContactSent(true);
  }

  const shown = results ?? recent;

  return (
    <>
      <ScrollThread />

      <nav className="nav glass">
        <div className="nav-brand" onClick={() => scrollTo('workspace')}>Kep<span>to</span></div>
        <div className="nav-tabs">
          <button className="nav-tab" onClick={() => scrollTo('workspace')}>Workspace</button>
          <button className="nav-tab" onClick={() => scrollTo('how')}>How it Works</button>
          <button className="nav-tab" onClick={() => scrollTo('about')}>About</button>
          <button className="nav-tab" onClick={() => scrollTo('contact')}>Contact</button>
        </div>
        <div className="nav-auth">
          {authReady && (session
            ? <button className="chip" onClick={() => supabase.auth.signOut()}>Sign out</button>
            : <Link className="chip chip-solid" href="/login">Log in</Link>)}
        </div>
      </nav>

      {/* ===================== WORKSPACE (top) ===================== */}
      <section id="workspace" className="section">
        <div className="hero">
          <div className="eyebrow">your digital second brain</div>
          <h1 className="hero-title">Save it now.<br/><span>Find it by meaning</span> later.</h1>
          <p className="hero-sub">Drop in anything — a link, a thought, an image, a voice memo. Kepto reads it, remembers it, and hands it back when you describe it in plain words.</p>
          <button className="btn-primary" onClick={enterWorkspace}>Enter Workspace</button>
        </div>

        <div className="workspace">
          {authReady && !session && (
            <div className="panel glass signin-cta">
              <p className="panel-label">workspace locked</p>
              <p className="hero-sub" style={{ margin: '0 0 16px' }}>Log in to start saving and searching your second brain.</p>
              <Link className="btn-primary" href="/login">Log in to continue</Link>
            </div>
          )}

          {session && (
            <>
              <SaveCounter usage={usage} />

              <div className="panel glass" id="save-box">
                <p className="panel-label">Save anything</p>
                <textarea ref={saveRef} placeholder="Paste a link, jot an idea, or tap the mic and speak…"
                  value={note} onChange={(e) => setNote(e.target.value)} />
                {image && (
                  <div className="img-preview">
                    <img src={image.preview} alt="preview" />
                    <button className="img-remove" onClick={() => setImage(null)}>✕</button>
                  </div>
                )}
                <div className="row">
                  <button className="btn-save" onClick={save} disabled={saving || (!note.trim() && !image) || usage?.remaining === 0}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="mic" title="Attach image" onClick={() => fileRef.current.click()}><ImageIcon /></button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImage(e.target.files[0])} />
                  <button className={`mic ${micNote ? 'on' : ''}`} title="Dictate" onClick={() => {
                    if (micNote) { speechNote.stop(); setMicNote(false); return; }
                    setMicNote(true); speechNote.start((t) => setNote((p) => (p ? p + ' ' : '') + t), () => setMicNote(false));
                  }}><MicIcon /></button>
                </div>
                {savedMsg && <div className="saved-toast">✓ {savedMsg}</div>}
                {saveErr && <div className="err">{saveErr}</div>}
                <p className="hint">Links get scraped for a title automatically; notes and images get an AI title, description, and tags.</p>
              </div>

              <div className="panel glass">
                <p className="panel-label">Ask for it back</p>
                <div className="row">
                  <input type="text" placeholder='"that dark UI design link I saved a while back"'
                    value={query} onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && ask()} />
                  <button className={`mic ${micAsk ? 'on' : ''}`} title="Ask by voice" onClick={() => {
                    if (micAsk) { speechAsk.stop(); setMicAsk(false); return; }
                    setMicAsk(true); speechAsk.start((t) => { setQuery(t); setTimeout(ask, 80); }, () => setMicAsk(false));
                  }}><MicIcon /></button>
                  <button className="btn-save" onClick={ask} disabled={searching || !query.trim()}>{searching ? 'Searching…' : 'Ask'}</button>
                </div>
                {searchErr && <div className="err">{searchErr}</div>}
                <p className="hint">Searches by meaning — reads the top answer back aloud.</p>
              </div>

              <div className="row" style={{ justifyContent: 'space-between', margin: '4px 4px 0' }}>
                <p className="panel-label" style={{ margin: 0 }}>{results ? 'Results' : 'Recently saved'}</p>
                {results && <button className="chip" onClick={() => setResults(null)}>Clear</button>}
              </div>
              {shown && shown.length === 0 && <div className="empty">{results ? 'Nothing matched — try describing it differently.' : 'Nothing saved yet. Save something above to begin.'}</div>}
              {shown && shown.length > 0 && (
                <div className="results">
                  {shown.map((it, i) => (
                    <ItemCard key={it.id} it={it} index={i} highlight={!!results && i === 0}
                      deleting={deletingId === it.id} onDelete={removeItem}
                      onSaveTitle={saveTitle} onAddTag={addTag} onRemoveTag={removeTag} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section id="how" className="section">
        <div className="section-head reveal">
          <div className="eyebrow">how it works</div>
          <h2 className="section-title">Five steps, <span>zero filing</span></h2>
          <p className="section-sub">The simple process that powers your second brain.</p>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <div key={s.num} className={`step glass reveal${s.active ? ' active' : ''}`}>
              <span className="step-num">{s.num}</span>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-body">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== ABOUT ===================== */}
      <section id="about" className="section">
        <div className="about glass reveal">
          <div className="eyebrow">about us</div>
          <h2 className="section-title">Built for things you'd<br/><span>otherwise forget</span></h2>
          <p className="about-body">Every day you run into something worth keeping — a link, an idea, a screenshot — and the friction of filing it means it's gone by tomorrow. Kepto removes the filing. You save; the AI reads, titles, and tags it in the background; and months later you find it by describing it, not by remembering where you put it.</p>
          <p className="about-body">It's a student project built entirely on free, open tools — Next.js, Supabase, Groq, and Cohere — and designed to prove that a genuinely useful "second brain" doesn't need a subscription to exist.</p>
          <div className="about-stats">
            <div className="stat"><strong>4</strong><span>saves / hour, free</span></div>
            <div className="stat"><strong>Meaning</strong><span>not filenames</span></div>
            <div className="stat"><strong>100%</strong><span>free-tier stack</span></div>
          </div>
        </div>
      </section>

      {/* ===================== CONTACT ===================== */}
      <section id="contact" className="section">
        <div className="contact glass reveal">
          <div className="eyebrow">contact us</div>
          <h2 className="section-title">Say <span>hello</span></h2>
          <p className="section-sub" style={{ marginBottom: 22 }}>Leave your email and Kepto's maker will get back to you.</p>
          {contactSent ? (
            <div className="saved-toast" style={{ fontSize: 14 }}>✓ Thanks — you're on the list.</div>
          ) : (
            <div className="contact-form">
              <input type="email" placeholder="you@email.com" value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitContact()} />
              <button className="btn-save" onClick={submitContact} disabled={!contactEmail.trim()}>Submit</button>
            </div>
          )}
        </div>
        <footer className="footer">Kepto — your digital second brain. Built with free tools.</footer>
      </section>
    </>
  );
}
