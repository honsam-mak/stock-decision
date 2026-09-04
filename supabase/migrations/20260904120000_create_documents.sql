begin;

create table if not exists public.documents (
    user_id text not null,
    collection text not null,
    id text not null,
    data jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    primary key (user_id, collection, id),
    constraint documents_collection_not_empty check (collection <> ''),
    constraint documents_id_not_empty check (id <> ''),
    constraint documents_user_id_not_empty check (user_id <> '')
);

create index if not exists documents_user_collection_updated_idx
    on public.documents (user_id, collection, updated_at);

-- The backend owns data access and always supplies the authenticated user_id.
-- Block direct Supabase Data API access unless a later migration intentionally
-- adds narrowly scoped policies.
alter table public.documents enable row level security;
revoke all on table public.documents from anon, authenticated;

commit;
