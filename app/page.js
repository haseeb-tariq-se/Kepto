'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getBrowserSupabase } from '../lib/supabase-browser';

/* ---------- icons ---------- */
const MicIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/></svg>);
const ImageIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>);
const PencilIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>);

/* ---------- source metadata ---------- */
const SOURCE_META = {
  instagram: { label: 'Instagram', color: '#e1306c' },
  tiktok: { label: 'TikTok', color: '#25f4ee' },
  youtube: { label: 'YouTube', color: '#ff4444' },
  snapchat: { label: 'Snapchat', color: '#fec700' },
  x: { label: 'X', color: '#e7e9ea' },
  web: { label: 'Web link', color: '#22d3ee' },
  note: { label: 'Note', color: '#ff7a3d' },
};
function srcOf(it) { return it.source || (it.source_url ? 'web' : 'note'); }

/* ---------- voice + tts ---------- */
function useSpeech() {
  const recRef = useRef(null);
  const start = (onResult, onEnd) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice works best in Chrome.'); onEnd?.(); return; }
    const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false;
    rec.onresult = (e) => onResult(e.results[0][0].transcript);
    rec.onend = () => onEnd?.(); rec.onerror = () => onEnd?.();
    recRef.current = rec; rec.start();
  };
  return { start, stop: () => recRef.current?.stop() };
}
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
function relTime(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo} month${mo > 1 ? 's' : ''} ago`;
  return `${Math.floor(mo / 12)} year(s) ago`;
}

/* ---------- saved item card ---------- */
function ItemCard({ it, index, tick, selectMode, checked, onCheck, onDelete, onSaveTitle, onAddTag, onRemoveTag, onTogglePin, onTagClick, onCopy, highlight }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(it.title || '');
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [copied, setCopied] = useState(false);
  const heading = it.title || it.ai_description || 'Saved item';
  const m = SOURCE_META[srcOf(it)] || SOURCE_META.note;

  function commitTitle() { setEditing(false); const v = draft.trim(); if (v && v !== it.title) onSaveTitle(it.id, v); }
  function commitTag() { const v = newTag.trim(); if (v) onAddTag(it, v); setNewTag(''); setAdding(false); }
  function copy() { onCopy(it); setCopied(true); setTimeout(() => setCopied(false), 1200); }

  return (
    <div className={`result glass${selectMode ? ' selectable' : ''}${checked ? ' selected' : ''}${it.pinned ? ' pinned-card' : ''}${highlight ? ' result-top' : ''}`}
         style={{ animationDelay: `${index * 50}ms` }}>
      {it.pinned && <span className="pin-badge">PINNED</span>}
      {selectMode && <input type="checkbox" className="sel-check" checked={checked} onChange={() => onCheck(it.id)} />}
      <button className="result-del" title="Delete" onClick={() => onDelete(it.id)}>✕</button>

      {it.image_base64 && <img src={`data:${it.image_mime};base64,${it.image_base64}`} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 12, maxHeight: 200, objectFit: 'cover' }} />}

      <div className="result-head">
        {editing ? (
          <input className="title-edit" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditing(false); }} />
        ) : (<h4 className="result-title">{heading}</h4>)}
        <button className="pencil" title="Edit title" onClick={() => { setDraft(it.title || heading); setEditing(true); }}><PencilIcon /></button>
      </div>

      <span className="src-badge" style={{ color: m.color, borderColor: `${m.color}55` }}>
        <span className="src-dot" style={{ background: m.color }} />{m.label}
      </span>

      {it.title && it.ai_description && it.ai_description !== it.title && <p className="result-desc-sub">{it.ai_description}</p>}
      {it.why && <div className="why"><span>✦</span> Matched because {it.why}</div>}

      <p className="result-content">
        {it.source_url ? <a href={it.source_url} target="_blank" rel="noreferrer">{it.source_url}</a> : it.content !== '[image]' ? it.content : null}
      </p>

      <div className="tags">
        {(it.tags || []).map((t) => (
          <span className="tag tag-glow" key={t} style={{ cursor: 'pointer' }} onClick={() => onTagClick(t)}>
            {t}<button className="tag-x" title="Remove tag" onClick={(e) => { e.stopPropagation(); onRemoveTag(it, t); }}>×</button>
          </span>
        ))}
        {adding ? (
          <input className="tag-input" value={newTag} autoFocus placeholder="tag…" onChange={(e) => setNewTag(e.target.value)} onBlur={commitTag}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTag(); if (e.key === 'Escape') setAdding(false); }} />
        ) : (<button className="tag-add" onClick={() => setAdding(true)}>+ tag</button>)}
      </div>

      <div className="card-foot">
        <span className="hint" style={{ margin: 0 }}>{relTime(it.created_at)}</span>
        <div className="foot-actions">
          <button className={`pin-btn${it.pinned ? ' pinned' : ''}`} onClick={() => onTogglePin(it)}>{it.pinned ? '★ Pinned' : '☆ Pin'}</button>
          <button className="copy-btn" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- rate-limit counter ---------- */
function SaveCounter({ usage }) {
  if (!usage) return null;
  const { remaining, limit, resetAt } = usage;
  const reset = resetAt ? new Date(resetAt) : null;
  return (
    <div className={`counter glass${remaining === 0 ? ' counter-empty' : ''}`}>
      <div className="counter-dots">{Array.from({ length: limit }).map((_, i) => <span key={i} className={`cdot${i < remaining ? ' on' : ''}`} />)}</div>
      <div className="counter-text">
        {remaining > 0 ? <><strong>{remaining}</strong> {remaining === 1 ? 'save' : 'saves'} remaining this hour</>
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

/* ---------- neon neural thread ---------- */
function ScrollThread() {
  const [d, setD] = useState('');
  const raf = useRef(0);
  const build = useCallback(() => {
    const w = window.innerWidth, h = window.innerHeight, doc = document.documentElement;
    const prog = doc.scrollHeight > h ? window.scrollY / (doc.scrollHeight - h) : 0;
    const cx = w * 0.5, amp = Math.min(w * 0.22, 240), N = 6, pts = [];
    for (let i = 0; i <= N; i++) { const t = i / N; pts.push([cx + amp * Math.sin(t * Math.PI * 2.2 + prog * Math.PI * 2), t * h]); }
    let path = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], my = (y0 + y1) / 2; path += ` C ${x0.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`; }
    setD(path);
  }, []);
  useEffect(() => {
    const onScroll = () => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(build); };
    build(); window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', build);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', build); cancelAnimationFrame(raf.current); };
  }, [build]);
  return (
    <svg className="thread" aria-hidden="true" preserveAspectRatio="none">
      <defs><linearGradient id="threadg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" /><stop offset="55%" stopColor="#ff7a3d" /><stop offset="100%" stopColor="#a855f7" /></linearGradient></defs>
      <path d={d} className="thread-glow" /><path d={d} className="thread-core" stroke="url(#threadg)" />
    </svg>
  );
}

const VISIBLE = 3;

export default function Home() {
  const supabase = getBrowserSupabase();
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [note, setNote] = useState('');
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');
  const [dupePrompt, setDupePrompt] = useState(null);
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

  const [items, setItems] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('new');
  const [activeTag, setActiveTag] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [tick, setTick] = useState(0); // drives live timestamps

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [confirmDel, setConfirmDel] = useState(null); // {ids} or {id}
  const [confirmOut, setConfirmOut] = useState(false);

  const [contactEmail, setContactEmail] = useState('');
  const [contactSent, setContactSent] = useState(false);

  const token = session?.access_token;
  const authHeaders = useCallback((extra = {}) => (token ? { ...extra, Authorization: `Bearer ${token}` } : extra), [token]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const loadItems = useCallback(async () => {
    if (!token) return;
    try { const res = await fetch('/api/items', { headers: authHeaders() }); const data = await res.json(); if (res.ok) setItems(data.items || []); } catch {}
  }, [token, authHeaders]);
  const loadUsage = useCallback(async () => {
    if (!token) return;
    try { const res = await fetch('/api/usage', { headers: authHeaders() }); const data = await res.json(); if (res.ok) setUsage(data.usage); } catch {}
  }, [token, authHeaders]);
  useEffect(() => { if (token) { loadItems(); loadUsage(); } }, [token, loadItems, loadUsage]);

  // live timestamp updater
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  // scroll reveal
  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach((c, i) => { c.style.transitionDelay = `${(i % 5) * 70}ms`; io.observe(c); });
    return () => io.disconnect();
  }, [authReady, session]);

  function scrollTo(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }

  function handleImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setImage({ base64: e.target.result.split(',')[1], mime: file.type, preview: e.target.result });
    reader.readAsDataURL(file);
  }

  async function save(force = false) {
    if ((!note.trim() && !image) || saving) return;
    setSaving(true); setSaveErr(''); setSavedMsg(''); if (!force) setDupePrompt(null);
    try {
      const res = await fetch('/api/save', {
        method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content: note.trim() || '[image]', imageBase64: image?.base64 || null, imageMime: image?.mime || null, force }),
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicate) { setDupePrompt(data.error); return; }
      if (res.status === 429) { setUsage(data.usage); setSaveErr(data.error); return; }
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setNote(''); setImage(null); setDupePrompt(null);
      setSavedMsg(`Saved — ${data.item.title || (data.item.tags || []).join(', ')}`);
      setTimeout(() => setSavedMsg(''), 2500);
      if (data.usage) setUsage(data.usage);
      setItems((prev) => [data.item, ...prev]);
    } catch (e) { setSaveErr(e.message); }
    finally { setSaving(false); }
  }

  async function ask() {
    if (!query.trim() || searching) return;
    setSearching(true); setSearchErr(''); setResults(null);
    try {
      const res = await fetch('/api/search', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ query: query.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.items);
      const top = data.items?.[0];
      if (top) speak(`${top.title || top.ai_description || top.content}. ${top.why || ''}`);
    } catch (e) { setSearchErr(e.message); }
    finally { setSearching(false); }
  }

  async function patchItem(id, body) {
    const res = await fetch('/api/items', { method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ id, ...body }) });
    const data = await res.json();
    if (res.ok && data.item) setItems((prev) => prev.map((it) => (it.id === id ? data.item : it)));
  }
  const saveTitle = (id, title) => patchItem(id, { title });
  const addTag = (it, tag) => { const t = tag.toLowerCase(); if (!(it.tags || []).includes(t)) patchItem(it.id, { tags: [...(it.tags || []), t] }); };
  const removeTag = (it, tag) => patchItem(it.id, { tags: (it.tags || []).filter((x) => x !== tag) });
  const togglePin = (it) => patchItem(it.id, { pinned: !it.pinned });
  const copyItem = (it) => navigator.clipboard?.writeText(it.source_url || it.content || '');

  async function doDelete(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    try {
      const qs = list.length > 1 ? `ids=${list.join(',')}` : `id=${list[0]}`;
      const res = await fetch(`/api/items?${qs}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
      const set = new Set(list);
      setItems((prev) => prev.filter((it) => !set.has(it.id)));
      setResults((prev) => prev?.filter((it) => !set.has(it.id)) ?? prev);
      setSelected(new Set()); setSelectMode(false);
    } catch (e) { alert(e.message); }
    setConfirmDel(null);
  }

  function toggleSel(id) { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  async function bulkTag() {
    if (!selected.size) return;
    const tag = prompt(`Add a tag to ${selected.size} selected item(s):`);
    if (!tag || !tag.trim()) return;
    const ids = [...selected];
    await fetch('/api/items', { method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ ids, addTag: tag.trim() }) });
    loadItems(); setSelected(new Set()); setSelectMode(false);
  }
  function exportXlsx(ids) {
    const base = `/api/export`;
    const url = ids && ids.length ? `${base}?ids=${ids.join(',')}` : base;
    // fetch with auth then trigger download (can't set headers on a plain link)
    fetch(url, { headers: authHeaders() }).then(async (r) => {
      if (!r.ok) { alert('Export failed'); return; }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `kepto-saves-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click(); URL.revokeObjectURL(a.href);
    });
  }

  async function submitContact() {
    if (!contactEmail.trim()) return;
    try { await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: contactEmail.trim() }) }); } catch {}
    setContactSent(true);
  }

  // derived list
  const allTags = [...new Set(items.flatMap((it) => it.tags || []))].sort();
  const sourceCounts = items.reduce((a, it) => { const s = srcOf(it); a[s] = (a[s] || 0) + 1; return a; }, {});
  const visibleList = (() => {
    const q = filterText.trim().toLowerCase();
    let list = items.filter((it) => {
      if (activeTag && !(it.tags || []).includes(activeTag)) return false;
      if (sourceFilter !== 'all' && srcOf(it) !== sourceFilter) return false;
      if (!q) return true;
      return (it.title || '').toLowerCase().includes(q) || (it.content || '').toLowerCase().includes(q) || (it.tags || []).some((t) => t.includes(q));
    });
    list = [...list].sort((a, b) => { if (a.pinned !== b.pinned) return a.pinned ? -1 : 1; const ta = new Date(a.created_at).getTime(), tb = new Date(b.created_at).getTime(); return sortOrder === 'new' ? tb - ta : ta - tb; });
    return list;
  })();
  const shownList = results ?? (expanded ? visibleList : visibleList.slice(0, VISIBLE));

  return (
    <>
      <ScrollThread />

      <nav className="nav glass">
        <div className="nav-brand" onClick={() => scrollTo('workspace')}>Kep<span>to</span></div>
        <div className="nav-auth">
          {authReady && (session
            ? <button className="chip" onClick={() => setConfirmOut(true)}>Sign out</button>
            : <Link className="chip chip-solid" href="/login">Log in</Link>)}
        </div>
      </nav>

      <section id="workspace" className="section">
        <div className="hero">
          <div className="eyebrow">your digital second brain</div>
          <h1 className="hero-title">Save it now.<br/><span>Find it by meaning</span> later.</h1>
          <p className="hero-sub">Drop in anything — a link, a thought, an image, a voice memo. Kepto reads it, remembers it, and hands it back when you describe it in plain words.</p>
          {authReady && !session && <p className="hero-sub" style={{ marginTop: -6, fontSize: 13, opacity: 0.7 }}>Log in to start saving.</p>}
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
                <div className="glow-wrap">
                  <textarea ref={saveRef} maxLength={5000} placeholder="Paste a link, jot an idea, or tap the mic and speak…" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div className="char-count">{note.length} / 5000</div>
                {image && (<div className="img-preview"><img src={image.preview} alt="preview" /><button className="img-remove" onClick={() => setImage(null)}>✕</button></div>)}
                <div className="row">
                  <button className="btn-save" onClick={() => save(false)} disabled={saving || (!note.trim() && !image) || usage?.remaining === 0}>{saving ? 'Saving…' : 'Save'}</button>
                  <button className="mic" title="Attach image" onClick={() => fileRef.current.click()}><ImageIcon /></button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImage(e.target.files[0])} />
                  <button className={`mic ${micNote ? 'on' : ''}`} title="Dictate" onClick={() => { if (micNote) { speechNote.stop(); setMicNote(false); return; } setMicNote(true); speechNote.start((t) => setNote((p) => (p ? p + ' ' : '') + t), () => setMicNote(false)); }}><MicIcon /></button>
                </div>
                {savedMsg && <div className="saved-toast">✓ {savedMsg}</div>}
                {dupePrompt && <div className="err" style={{ color: '#ffcf6b' }}>⚠ {dupePrompt} <button className="copy-btn" style={{ marginLeft: 6 }} onClick={() => save(true)}>Save anyway</button></div>}
                {saveErr && <div className="err">{saveErr}</div>}
                <p className="hint">Tip: links get auto-titled; notes & images get an AI title, description, and tags.</p>
              </div>

              <div className="panel glass">
                <p className="panel-label">Ask for it back</p>
                <div className="row">
                  <div className="glow-wrap glow-flex"><input type="text" placeholder='"that dark UI design link I saved a while back"' value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} /></div>
                  <button className={`mic ${micAsk ? 'on' : ''}`} title="Ask by voice" onClick={() => { if (micAsk) { speechAsk.stop(); setMicAsk(false); return; } setMicAsk(true); speechAsk.start((t) => { setQuery(t); setTimeout(ask, 80); }, () => setMicAsk(false)); }}><MicIcon /></button>
                  <button className="btn-save" onClick={ask} disabled={searching || !query.trim()}>{searching ? 'Searching…' : 'Ask'}</button>
                </div>
                {searchErr && <div className="err">{searchErr}</div>}
                <p className="hint">Searches by meaning — reads the top answer back aloud.</p>
              </div>

              {/* Your saves */}
              <div className="saved-section">
                <div className="saved-toolbar">
                  <div className="left">
                    <p className="panel-label" style={{ margin: 0 }}>{results ? 'Results' : 'Your saves'}</p>
                    {!results && <span className="count-badge">{items.length} saved</span>}
                    {results ? <button className="chip" onClick={() => setResults(null)}>Clear results</button>
                      : <input type="text" className="mini-search" placeholder="filter by text or tag…" value={filterText} onChange={(e) => setFilterText(e.target.value)} />}
                  </div>
                  {!results && (
                    <div className="left">
                      <select className="sort-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} title="Filter by source">
                        <option value="all">All sources ({items.length})</option>
                        <option value="instagram">Instagram ({sourceCounts.instagram || 0})</option>
                        <option value="tiktok">TikTok ({sourceCounts.tiktok || 0})</option>
                        <option value="youtube">YouTube ({sourceCounts.youtube || 0})</option>
                        <option value="snapchat">Snapchat ({sourceCounts.snapchat || 0})</option>
                        <option value="x">X / Twitter ({sourceCounts.x || 0})</option>
                        <option value="web">Web links ({sourceCounts.web || 0})</option>
                        <option value="note">Notes ({sourceCounts.note || 0})</option>
                      </select>
                      <select className="sort-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                        <option value="new">Newest first</option>
                        <option value="old">Oldest first</option>
                      </select>
                      <button className="tool-btn export-btn" onClick={() => exportXlsx()} title="Download all as Excel">⬇ Export Excel</button>
                      <button className="tool-btn" onClick={() => { setSelectMode((s) => !s); setSelected(new Set()); }}>{selectMode ? 'Cancel' : 'Select'}</button>
                      {selectMode && <button className="tool-btn" disabled={!selected.size} onClick={bulkTag}>Tag ({selected.size})</button>}
                      {selectMode && <button className="tool-btn export-btn" disabled={!selected.size} onClick={() => exportXlsx([...selected])}>Export ({selected.size})</button>}
                      {selectMode && <button className="tool-btn danger" disabled={!selected.size} onClick={() => setConfirmDel({ ids: [...selected] })}>Delete ({selected.size})</button>}
                    </div>
                  )}
                </div>

                {!results && allTags.length > 0 && (
                  <div className="filter-chips">
                    {allTags.map((t) => <button key={t} className={`fchip${activeTag === t ? ' on' : ''}`} onClick={() => setActiveTag(activeTag === t ? null : t)}>#{t}</button>)}
                    {activeTag && <button className="fchip fchip-clear" onClick={() => setActiveTag(null)}>clear ✕</button>}
                  </div>
                )}

                {shownList && shownList.length === 0 && (
                  <div className="empty-rich">
                    <svg viewBox="0 0 64 64" fill="none" stroke="url(#threadg)" strokeWidth="2"><rect x="12" y="10" width="40" height="44" rx="6" /><path d="M22 24h20M22 32h20M22 40h12" strokeLinecap="round" /></svg>
                    <h4>{results ? 'Nothing matched' : 'Nothing here yet'}</h4>
                    <p>{results ? 'Try describing it differently.' : 'Save a link or a thought above — it’ll show up here, searchable by meaning.'}</p>
                    {!results && <button className="btn-save" onClick={() => saveRef.current?.focus()}>Save your first thing</button>}
                  </div>
                )}

                {shownList && shownList.length > 0 && (
                  <div className="results">
                    {shownList.map((it, i) => (
                      <ItemCard key={it.id} it={it} index={i} tick={tick} selectMode={selectMode && !results} checked={selected.has(it.id)}
                        onCheck={toggleSel} onDelete={(id) => setConfirmDel({ id })} onSaveTitle={saveTitle} onAddTag={addTag} onRemoveTag={removeTag}
                        onTogglePin={togglePin} onTagClick={(t) => setActiveTag(t)} onCopy={copyItem} highlight={!!results && i === 0} />
                    ))}
                  </div>
                )}

                {!results && visibleList.length > VISIBLE && (
                  <div style={{ textAlign: 'center', marginTop: 14 }}>
                    <button className="expand-btn" onClick={() => setExpanded((x) => !x)}>{expanded ? 'Show less ▲' : `Show ${visibleList.length - VISIBLE} more ▼`}</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <section id="how" className="section">
        <div className="section-head reveal"><div className="eyebrow">how it works</div><h2 className="section-title">Five steps, <span>zero filing</span></h2><p className="section-sub">The simple process that powers your second brain.</p></div>
        <div className="steps">{STEPS.map((s) => (<div key={s.num} className={`step glass reveal${s.active ? ' active' : ''}`}><span className="step-num">{s.num}</span><h3 className="step-title">{s.title}</h3><p className="step-body">{s.body}</p></div>))}</div>
      </section>

      <section id="about" className="section">
        <div className="about glass reveal">
          <div className="eyebrow">about us</div>
          <h2 className="section-title">Built for things you'd<br/><span>otherwise forget</span></h2>
          <p className="about-body">Every day you run into something worth keeping — a link, an idea, a screenshot — and the friction of filing it means it's gone by tomorrow. Kepto removes the filing. You save; the AI reads, titles, and tags it in the background; and months later you find it by describing it, not by remembering where you put it.</p>
          <p className="about-body">It's a student project built entirely on free, open tools — Next.js, Supabase, Groq, and Cohere — and designed to prove that a genuinely useful "second brain" doesn't need a subscription to exist.</p>
          <div className="about-stats"><div className="stat"><strong>7</strong><span>saves / hour, free</span></div><div className="stat"><strong>Meaning</strong><span>not filenames</span></div><div className="stat"><strong>100%</strong><span>free-tier stack</span></div></div>
        </div>
      </section>

      <section id="contact" className="section">
        <div className="contact glass reveal">
          <div className="eyebrow">contact us</div>
          <h2 className="section-title">Say <span>hello</span></h2>
          <p className="section-sub" style={{ marginBottom: 22 }}>Leave your email and Kepto's maker will get back to you.</p>
          {contactSent ? <div className="saved-toast" style={{ fontSize: 14 }}>✓ Thanks — you're on the list.</div>
            : (<div className="contact-form"><input type="email" placeholder="you@email.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitContact()} /><button className="btn-save" onClick={submitContact} disabled={!contactEmail.trim()}>Submit</button></div>)}
        </div>
        <footer className="footer">Kepto — your digital second brain. Built with free tools.</footer>
      </section>

      {/* sign-out confirm */}
      {confirmOut && (
        <div className="modal-bg" onClick={() => setConfirmOut(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h3>Sign out?</h3><p>You'll need to log back in to reach your saved items.</p>
            <div className="modal-row"><button className="btn-ghost" onClick={() => setConfirmOut(false)}>Cancel</button><button className="btn-danger" onClick={() => { setConfirmOut(false); supabase.auth.signOut(); }}>Sign out</button></div>
          </div>
        </div>
      )}

      {/* delete confirm */}
      {confirmDel && (
        <div className="modal-bg" onClick={() => setConfirmDel(null)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmDel.ids ? `Delete ${confirmDel.ids.length} item${confirmDel.ids.length > 1 ? 's' : ''}?` : 'Delete this item?'}</h3>
            <p>This can't be undone.</p>
            <div className="modal-row"><button className="btn-ghost" onClick={() => setConfirmDel(null)}>Cancel</button><button className="btn-danger" onClick={() => doDelete(confirmDel.ids || confirmDel.id)}>Delete</button></div>
          </div>
        </div>
      )}
    </>
  );
}
