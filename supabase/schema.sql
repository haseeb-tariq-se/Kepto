-- ============================================================
--  Kepto database schema — safe to run on a fresh OR partial DB
--  (paste the whole file into Supabase SQL Editor, press RUN)
-- ============================================================

create extension if not exists vector;

-- items: create if missing, add any missing columns if it already exists
create table if not exists items (
  id uuid primary key default gen_random_uuid()
);
alter table items add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table items add column if not exists type text not null default 'note';
alter table items add column if not exists source text default 'note';   -- instagram|tiktok|youtube|snapchat|x|web|note
alter table items add column if not exists title text;
alter table items add column if not exists content text;
alter table items add column if not exists source_url text;
alter table items add column if not exists ai_description text;
alter table items add column if not exists tags text[] default '{}';
alter table items add column if not exists embedding vector(1024);
alter table items add column if not exists image_base64 text;
alter table items add column if not exists image_mime text;
alter table items add column if not exists pinned boolean default false;   -- pin-to-top
alter table items add column if not exists created_at timestamptz default now();
alter table items alter column content set not null;

create index if not exists items_user_idx on items (user_id, created_at desc);

-- append-only save log powers the strict per-hour rate limit
create table if not exists save_events (
  id bigint generated always as identity primary key
);
alter table save_events add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table save_events add column if not exists created_at timestamptz default now();
create index if not exists save_events_user_time_idx on save_events (user_id, created_at desc);

-- optional: emails captured by the Contact form
create table if not exists contact_messages (
  id bigint generated always as identity primary key,
  email text not null,
  created_at timestamptz default now()
);

-- semantic search, scoped to one user (now returns source + pinned)
create or replace function match_items(
  p_user_id uuid,
  query_embedding vector(1024),
  match_count int default 6
)
returns table (
  id uuid, type text, source text, title text, content text, source_url text,
  ai_description text, tags text[], pinned boolean, image_base64 text, image_mime text,
  created_at timestamptz, similarity float
)
language sql stable
as $$
  select
    items.id, items.type, items.source, items.title, items.content, items.source_url,
    items.ai_description, items.tags, items.pinned, items.image_base64, items.image_mime,
    items.created_at,
    1 - (items.embedding <=> query_embedding) as similarity
  from items
  where items.embedding is not null
    and items.user_id = p_user_id
  order by items.embedding <=> query_embedding
  limit match_count;
$$;

create index if not exists items_embedding_idx
  on items using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table items enable row level security;
alter table save_events enable row level security;
alter table contact_messages enable row level security;

notify pgrst, 'reload schema';
