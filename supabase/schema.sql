create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  focus text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opponent text not null,
  date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  training_id uuid not null references public.training_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_id, player_id)
);

create table if not exists public.player_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists players_user_created_idx on public.players(user_id, created_at desc);
create index if not exists training_sessions_user_date_idx on public.training_sessions(user_id, date);
create index if not exists matches_user_date_idx on public.matches(user_id, date);
create index if not exists attendance_training_user_idx on public.attendance(training_id, user_id);
create index if not exists feedback_player_created_idx on public.player_feedback(player_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_players_updated_at on public.players;
create trigger set_players_updated_at
before update on public.players
for each row execute function public.set_updated_at();

drop trigger if exists set_training_sessions_updated_at on public.training_sessions;
create trigger set_training_sessions_updated_at
before update on public.training_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_matches_updated_at on public.matches;
create trigger set_matches_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists set_attendance_updated_at on public.attendance;
create trigger set_attendance_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();

alter table public.players enable row level security;
alter table public.training_sessions enable row level security;
alter table public.matches enable row level security;
alter table public.attendance enable row level security;
alter table public.player_feedback enable row level security;

drop policy if exists "Users can read own players" on public.players;
create policy "Users can read own players"
on public.players for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own players" on public.players;
create policy "Users can insert own players"
on public.players for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own players" on public.players;
create policy "Users can update own players"
on public.players for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own players" on public.players;
create policy "Users can delete own players"
on public.players for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own trainings" on public.training_sessions;
create policy "Users can read own trainings"
on public.training_sessions for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own trainings" on public.training_sessions;
create policy "Users can insert own trainings"
on public.training_sessions for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own trainings" on public.training_sessions;
create policy "Users can update own trainings"
on public.training_sessions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own trainings" on public.training_sessions;
create policy "Users can delete own trainings"
on public.training_sessions for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own matches" on public.matches;
create policy "Users can read own matches"
on public.matches for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own matches" on public.matches;
create policy "Users can insert own matches"
on public.matches for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own matches" on public.matches;
create policy "Users can update own matches"
on public.matches for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own matches" on public.matches;
create policy "Users can delete own matches"
on public.matches for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own attendance" on public.attendance;
create policy "Users can read own attendance"
on public.attendance for select
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.training_sessions
    where training_sessions.id = attendance.training_id
    and training_sessions.user_id = auth.uid()
  )
);

drop policy if exists "Users can upsert own attendance" on public.attendance;
create policy "Users can upsert own attendance"
on public.attendance for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.training_sessions
    where training_sessions.id = attendance.training_id
    and training_sessions.user_id = auth.uid()
  )
  and exists (
    select 1 from public.players
    where players.id = attendance.player_id
    and players.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own feedback" on public.player_feedback;
create policy "Users can read own feedback"
on public.player_feedback for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own feedback" on public.player_feedback;
create policy "Users can insert own feedback"
on public.player_feedback for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.players
    where players.id = player_feedback.player_id
    and players.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own feedback" on public.player_feedback;
create policy "Users can delete own feedback"
on public.player_feedback for delete
using (auth.uid() = user_id);
