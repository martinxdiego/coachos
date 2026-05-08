-- Self-Service Spieler-Beitritt + persoenlicher Zugang + Trainer-Mitteilungen.
-- Pfad 1: Trainer teilt Team-Beitritts-Link → Spieler legt sich selbst an
-- Pfad 2: Spieler nutzt eigenen Token-Link fuer Check-ins, Saisonblatt, Notizen
-- Pfad 3: Trainer schickt Mitteilungen ins Postfach des Spielers

alter table public.teams
  add column if not exists player_signup_token uuid not null default gen_random_uuid();
create unique index if not exists teams_signup_token_idx
  on public.teams(player_signup_token);

alter table public.players
  add column if not exists access_token uuid not null default gen_random_uuid();
create unique index if not exists players_access_token_idx
  on public.players(access_token);

alter table public.players
  add column if not exists self_registered_at timestamptz;

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  category text not null default 'note'
    check (category in ('training_goal','match_goal','note','praise')),
  title text,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coach_messages_player_idx
  on public.coach_messages(player_id, created_at desc);

alter table public.coach_messages enable row level security;

drop policy if exists "Team members can manage coach messages" on public.coach_messages;
create policy "Team members can manage coach messages"
  on public.coach_messages for all using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  ) with check (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );
