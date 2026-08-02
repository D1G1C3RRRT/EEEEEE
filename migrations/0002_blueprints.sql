-- Blueprint vault: server-side persistence (PGLite preview + Neon deploy)
create table if not exists blueprints (
  id text primary key,
  title text not null,
  source_url text,
  content_hash text not null,
  source text not null default 'url',
  created_at timestamptz not null default CURRENT_TIMESTAMP,
  payload jsonb not null
);

create index if not exists blueprints_created_at_idx on blueprints (created_at desc);
