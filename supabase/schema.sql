-- Run this in your Supabase SQL editor to set up the crossword database.
-- Safe to run multiple times.

-- ── Puzzles table ─────────────────────────────────────────────────────────────

create table if not exists puzzles (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  author           text,
  difficulty       int  not null check (difficulty >= 1 and difficulty <= 5),
  grid_size_rows   int  not null,
  grid_size_cols   int  not null,
  grid             jsonb not null default '[]',
  clues_across     jsonb not null default '{}',
  clues_down       jsonb not null default '{}',
  solution         jsonb not null default '[]',
  source_file_url  text,
  is_published     boolean not null default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ── updated_at trigger ────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists puzzles_updated_at on puzzles;
create trigger puzzles_updated_at
  before update on puzzles
  for each row execute function set_updated_at();

-- ── Row level security ────────────────────────────────────────────────────────

alter table puzzles enable row level security;

drop policy if exists "Public read published puzzles"   on puzzles;
drop policy if exists "Anon can insert puzzles"         on puzzles;
drop policy if exists "Anon can update puzzles"         on puzzles;
drop policy if exists "Anon can read all puzzles (admin)" on puzzles;

create policy "Public read published puzzles"
  on puzzles for select using (is_published = true);

create policy "Anon can insert puzzles"
  on puzzles for insert with check (true);

create policy "Anon can update puzzles"
  on puzzles for update using (true);

create policy "Anon can read all puzzles (admin)"
  on puzzles for select using (true);

-- ── Grants ────────────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;
grant select, insert, update on puzzles to anon, authenticated;

-- ── Storage policies ──────────────────────────────────────────────────────────

drop policy if exists "Anyone can upload to puzzle-sources" on storage.objects;
drop policy if exists "Anyone can read puzzle-sources"      on storage.objects;

create policy "Anyone can upload to puzzle-sources"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'puzzle-sources');

create policy "Anyone can read puzzle-sources"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'puzzle-sources');
