-- ============================================================
--  Kepto database schema  —  run this in Supabase SQL Editor
--  (paste the whole file, press RUN)
-- ============================================================

-- 1. Semantic vector search
create extension if not exists vector;

-- 2. Everything a user saves lives here (now scoped per user + editable title)
create table if not exists items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  type           text not null default 'note',   -- note | link | image | voice | social
  title          text,                            -- editable display title (pencil icon)
  content        text not null,                   -- raw text / url / transcript
  source_url     text,
  ai_description text,                             -- Groq-written summary
  tags           text[] default '{}',             -- Groq tags + user's custom tags
  embedding      vector(1024),                    -- Cohere embed-v4.0 = 1024 dims
  image_base64   text,
  image_mime     text,
  created_at     timestamptz default now()
);
create index if not exists items_user_idx on items (user_id, created_at desc);

-- 3. Append-only save log — powers the STRICT 4-per-hour rate limit.
--    Kept separate from items so deleting a note never frees a slot.
create table if not exists save_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists save_events_user_time_idx on save_events (user_id, created_at desc);

-- 4. Semantic search: closest items BY MEANING, for one user only (cosine)
create or replace function match_items(
  p_user_id uuid,
  query_embedding vector(1024),
  match_count int default 6
)
returns table (
  id uuid, type text, title text, content text, source_url text,
  ai_description text, tags text[], image_base64 text, image_mime text,
  created_at timestamptz, similarity float
)
language sql stable
as $$
  select
    items.id, items.type, items.title, items.content, items.source_url,
    items.ai_description, items.tags, items.image_base64, items.image_mime,
    items.created_at,
    1 - (items.embedding <=> query_embedding) as similarity
  from items
  where items.embedding is not null
    and items.user_id = p_user_id
  order by items.embedding <=> query_embedding
  limit match_count;
$$;

-- 5. Speed index for vector search (helps past a few hundred items)
create index if not exists items_embedding_idx
  on items using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 6. Lock the tables down. All app access goes through our /api routes using
--    the SERVICE ROLE key (which bypasses RLS). Enabling RLS with no public
--    policy means that even if the anon key leaked, nobody can read or write
--    these tables directly from the browser.
alter table items enable row level security;
alter table save_events enable row level security;
