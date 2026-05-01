create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text,
  age_group text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'head_coach', 'coach')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  code text not null unique,
  role text not null check (role in ('head_coach', 'coach')),
  created_by uuid not null references auth.users(id) on delete cascade,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  first_name text,
  last_name text,
  position text,
  secondary_positions text[],
  birth_year integer,
  jersey_number integer,
  photo_url text,
  strong_foot text check (strong_foot is null or strong_foot in ('left', 'right', 'both')),
  height_cm integer,
  weight_kg numeric(5, 2),
  contact text,
  parent_contact text,
  medical_notes text,
  strengths text,
  weaknesses text,
  development_goals text,
  training_notes text,
  personal_notes text,
  notes text,
  status text not null default 'available' check (status in ('available', 'injured', 'limited', 'absent')),
  rating smallint check (rating between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  start_time time,
  duration_minutes integer,
  location text,
  focus text not null,
  goal text,
  age_group text,
  intensity text check (intensity is null or intensity in ('low', 'medium', 'high')),
  participants text,
  notes text,
  is_template boolean not null default false,
  template_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_phases (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  training_id uuid not null references public.training_sessions(id) on delete cascade,
  phase_type text not null check (phase_type in ('warmup', 'technique', 'tactics', 'game_form', 'finish', 'cooldown')),
  title text not null,
  duration_minutes integer,
  description text,
  coaching_points text,
  organization text,
  material text,
  player_count text,
  field_size text,
  variations text,
  load_management text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  opponent text not null,
  date date not null,
  kickoff_time time,
  location text,
  home_away text check (home_away is null or home_away in ('home', 'away', 'neutral')),
  meeting_point text,
  squad_notes text,
  starting_lineup text,
  substitutes text,
  formation text,
  tactical_instructions text,
  match_goals text,
  pre_match_notes text,
  halftime_notes text,
  post_match_notes text,
  result text,
  scorers text,
  assists text,
  cards text,
  player_ratings jsonb not null default '{}'::jsonb,
  conclusion text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
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
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('exercise_sheet', 'training_plan', 'match_plan', 'tactics_sheet', 'player_list', 'attendance_list', 'week_plan', 'month_plan')),
  title text not null,
  description text,
  content text,
  print_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tactic_boards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  elements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open', 'done')),
  due_date date,
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  related_type text,
  related_id uuid,
  title text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.winner_points (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  context_type text not null check (context_type in ('training', 'match', 'event', 'other', 'monday_training')),
  context_id uuid,
  context_label text,
  points integer not null check (points > 0 and points <= 50),
  reason text,
  awarded_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.external_links (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  link_type text not null check (link_type in ('clubcorner', 'player_stats', 'quali_document', 'meeting_notes', 'medical', 'other')),
  title text not null,
  url text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_evaluations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  context_type text not null check (context_type in ('training', 'match', 'event', 'monday_training')),
  context_id uuid,
  context_label text,
  evaluation_date date not null default current_date,
  participation smallint check (participation is null or participation between 1 and 5),
  motivation smallint check (motivation is null or motivation between 1 and 5),
  training_quality smallint check (training_quality is null or training_quality between 1 and 5),
  match_quality smallint check (match_quality is null or match_quality between 1 and 5),
  behavior smallint check (behavior is null or behavior between 1 and 5),
  effort smallint check (effort is null or effort between 1 and 5),
  concentration smallint check (concentration is null or concentration between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_checkins (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  checkin_date date not null default current_date,
  context_type text not null default 'training' check (context_type in ('training', 'match', 'free')),
  fatigue smallint not null check (fatigue between 1 and 5),
  sleep_quality smallint not null check (sleep_quality between 1 and 5),
  soreness smallint not null check (soreness between 1 and 5),
  pain smallint not null check (pain between 1 and 5),
  stress smallint not null check (stress between 1 and 5),
  motivation smallint not null check (motivation between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  injury_feeling smallint not null check (injury_feeling between 1 and 5),
  wellbeing smallint not null check (wellbeing between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, checkin_date, context_type)
);

create table if not exists public.match_analyses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  opponent_analysis text,
  match_preparation text,
  match_targets text,
  lineup_notes text,
  went_well text,
  needs_work text,
  key_moments text,
  individual_performances text,
  team_performance text,
  tactical_lessons text,
  next_training_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id)
);

create table if not exists public.monday_trainings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  topic text not null,
  goal text,
  duration_minutes integer,
  staff_notes text,
  sandu_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monday_attendance (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  monday_training_id uuid not null references public.monday_trainings(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'injured')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (monday_training_id, player_id)
);

create table if not exists public.player_awards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  previous_player_id uuid references public.players(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  event_label text,
  award_date date not null default current_date,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.players
add column if not exists team_id uuid references public.teams(id) on delete cascade,
add column if not exists first_name text,
add column if not exists last_name text,
add column if not exists secondary_positions text[],
add column if not exists birth_date date,
add column if not exists birth_year integer,
add column if not exists team_category text,
add column if not exists jersey_number integer,
add column if not exists photo_url text,
add column if not exists strong_foot text,
add column if not exists height_cm integer,
add column if not exists weight_kg numeric(5, 2),
add column if not exists contact text,
add column if not exists parent_contact text,
add column if not exists emergency_contact text,
add column if not exists player_account_email text,
add column if not exists favorite_team text,
add column if not exists favorite_player text,
add column if not exists football_goals text,
add column if not exists motivation text,
add column if not exists allergies text,
add column if not exists injuries text,
add column if not exists limitations text,
add column if not exists medications text,
add column if not exists coach_alerts text,
add column if not exists season_form_completed_at timestamptz,
add column if not exists medical_notes text,
add column if not exists strengths text,
add column if not exists weaknesses text,
add column if not exists development_goals text,
add column if not exists training_notes text,
add column if not exists personal_notes text,
add column if not exists status text not null default 'available',
add column if not exists rating smallint;

alter table public.training_sessions
add column if not exists team_id uuid references public.teams(id) on delete cascade,
add column if not exists start_time time,
add column if not exists duration_minutes integer,
add column if not exists location text,
add column if not exists goal text,
add column if not exists age_group text,
add column if not exists intensity text,
add column if not exists participants text,
add column if not exists is_template boolean not null default false,
add column if not exists template_name text;

alter table public.matches
add column if not exists team_id uuid references public.teams(id) on delete cascade,
add column if not exists competition text,
add column if not exists team_category text,
add column if not exists upload_source text,
add column if not exists kickoff_time time,
add column if not exists location text,
add column if not exists home_away text,
add column if not exists meeting_point text,
add column if not exists squad_notes text,
add column if not exists starting_lineup text,
add column if not exists substitutes text,
add column if not exists formation text,
add column if not exists tactical_instructions text,
add column if not exists match_goals text,
add column if not exists pre_match_notes text,
add column if not exists halftime_notes text,
add column if not exists post_match_notes text,
add column if not exists result text,
add column if not exists scorers text,
add column if not exists assists text,
add column if not exists cards text,
add column if not exists player_ratings jsonb not null default '{}'::jsonb,
add column if not exists conclusion text;

alter table public.attendance
add column if not exists team_id uuid references public.teams(id) on delete cascade;

alter table public.player_feedback
add column if not exists team_id uuid references public.teams(id) on delete cascade;

do $$
begin
  insert into public.teams (name, created_by)
  select 'CoachOS Workspace', source_users.user_id
  from (
    select user_id from public.players
    union
    select user_id from public.training_sessions
    union
    select user_id from public.matches
    union
    select user_id from public.attendance
    union
    select user_id from public.player_feedback
  ) as source_users
  where not exists (
    select 1 from public.team_members
    where team_members.user_id = source_users.user_id
  );

  insert into public.team_members (team_id, user_id, role)
  select teams.id, teams.created_by, 'owner'
  from public.teams
  where not exists (
    select 1 from public.team_members
    where team_members.team_id = teams.id
      and team_members.user_id = teams.created_by
  );

  update public.players as players
  set team_id = team_members.team_id
  from (
    select distinct on (user_id) user_id, team_id
    from public.team_members
    order by user_id, created_at asc
  ) as team_members
  where players.team_id is null
    and players.user_id = team_members.user_id;

  update public.players
  set first_name = split_part(name, ' ', 1),
      last_name = nullif(trim(substring(name from position(' ' in name) + 1)), '')
  where first_name is null
    and name is not null;

  update public.training_sessions as training_sessions
  set team_id = team_members.team_id
  from (
    select distinct on (user_id) user_id, team_id
    from public.team_members
    order by user_id, created_at asc
  ) as team_members
  where training_sessions.team_id is null
    and training_sessions.user_id = team_members.user_id;

  update public.matches as matches
  set team_id = team_members.team_id
  from (
    select distinct on (user_id) user_id, team_id
    from public.team_members
    order by user_id, created_at asc
  ) as team_members
  where matches.team_id is null
    and matches.user_id = team_members.user_id;

  update public.attendance as attendance
  set team_id = training_sessions.team_id
  from public.training_sessions as training_sessions
  where attendance.team_id is null
    and attendance.training_id = training_sessions.id;

  update public.player_feedback as player_feedback
  set team_id = players.team_id
  from public.players as players
  where player_feedback.team_id is null
    and player_feedback.player_id = players.id;
end;
$$;

alter table public.players alter column team_id set not null;
alter table public.training_sessions alter column team_id set not null;
alter table public.matches alter column team_id set not null;
alter table public.attendance alter column team_id set not null;
alter table public.player_feedback alter column team_id set not null;

create index if not exists teams_created_by_created_idx on public.teams(created_by, created_at desc);
create index if not exists team_members_user_created_idx on public.team_members(user_id, created_at asc);
create index if not exists team_members_team_role_idx on public.team_members(team_id, role);
create index if not exists team_invites_team_created_idx on public.team_invites(team_id, created_at desc);
create index if not exists team_invites_code_idx on public.team_invites(code);
create index if not exists players_team_name_idx on public.players(team_id, name);
create index if not exists players_team_position_idx on public.players(team_id, position);
create index if not exists training_sessions_team_date_idx on public.training_sessions(team_id, date);
create index if not exists training_phases_training_order_idx on public.training_phases(training_id, sort_order);
create index if not exists matches_team_date_idx on public.matches(team_id, date);
create index if not exists attendance_training_team_idx on public.attendance(training_id, team_id);
create index if not exists feedback_player_created_idx on public.player_feedback(player_id, created_at desc);
create index if not exists feedback_team_created_idx on public.player_feedback(team_id, created_at desc);
create index if not exists materials_team_created_idx on public.materials(team_id, created_at desc);
create index if not exists tactic_boards_team_created_idx on public.tactic_boards(team_id, created_at desc);
create index if not exists tasks_team_status_idx on public.tasks(team_id, status, due_date);
create index if not exists notes_team_related_idx on public.notes(team_id, related_type, related_id);
create index if not exists winner_points_team_awarded_idx on public.winner_points(team_id, awarded_at desc);
create index if not exists winner_points_player_created_idx on public.winner_points(player_id, created_at desc);
create index if not exists external_links_team_player_idx on public.external_links(team_id, player_id, link_type);
create index if not exists player_evaluations_team_date_idx on public.player_evaluations(team_id, evaluation_date desc);
create index if not exists player_evaluations_player_date_idx on public.player_evaluations(player_id, evaluation_date desc);
create index if not exists health_checkins_team_date_idx on public.health_checkins(team_id, checkin_date desc);
create index if not exists health_checkins_player_date_idx on public.health_checkins(player_id, checkin_date desc);
create index if not exists match_analyses_match_idx on public.match_analyses(match_id);
create index if not exists monday_trainings_team_date_idx on public.monday_trainings(team_id, date desc);
create index if not exists monday_attendance_training_idx on public.monday_attendance(monday_training_id, team_id);
create index if not exists player_awards_team_date_idx on public.player_awards(team_id, award_date desc);
create index if not exists player_awards_player_date_idx on public.player_awards(player_id, award_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_teams_updated_at on public.teams;
create trigger set_teams_updated_at before update on public.teams
for each row execute function public.set_updated_at();

drop trigger if exists set_players_updated_at on public.players;
create trigger set_players_updated_at before update on public.players
for each row execute function public.set_updated_at();

drop trigger if exists set_training_sessions_updated_at on public.training_sessions;
create trigger set_training_sessions_updated_at before update on public.training_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_training_phases_updated_at on public.training_phases;
create trigger set_training_phases_updated_at before update on public.training_phases
for each row execute function public.set_updated_at();

drop trigger if exists set_matches_updated_at on public.matches;
create trigger set_matches_updated_at before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists set_attendance_updated_at on public.attendance;
create trigger set_attendance_updated_at before update on public.attendance
for each row execute function public.set_updated_at();

drop trigger if exists set_materials_updated_at on public.materials;
create trigger set_materials_updated_at before update on public.materials
for each row execute function public.set_updated_at();

drop trigger if exists set_tactic_boards_updated_at on public.tactic_boards;
create trigger set_tactic_boards_updated_at before update on public.tactic_boards
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists set_winner_points_updated_at on public.winner_points;
create trigger set_winner_points_updated_at before update on public.winner_points
for each row execute function public.set_updated_at();

drop trigger if exists set_external_links_updated_at on public.external_links;
create trigger set_external_links_updated_at before update on public.external_links
for each row execute function public.set_updated_at();

drop trigger if exists set_player_evaluations_updated_at on public.player_evaluations;
create trigger set_player_evaluations_updated_at before update on public.player_evaluations
for each row execute function public.set_updated_at();

drop trigger if exists set_health_checkins_updated_at on public.health_checkins;
create trigger set_health_checkins_updated_at before update on public.health_checkins
for each row execute function public.set_updated_at();

drop trigger if exists set_match_analyses_updated_at on public.match_analyses;
create trigger set_match_analyses_updated_at before update on public.match_analyses
for each row execute function public.set_updated_at();

drop trigger if exists set_monday_trainings_updated_at on public.monday_trainings;
create trigger set_monday_trainings_updated_at before update on public.monday_trainings
for each row execute function public.set_updated_at();

drop trigger if exists set_monday_attendance_updated_at on public.monday_attendance;
create trigger set_monday_attendance_updated_at before update on public.monday_attendance
for each row execute function public.set_updated_at();

drop trigger if exists set_player_awards_updated_at on public.player_awards;
create trigger set_player_awards_updated_at before update on public.player_awards
for each row execute function public.set_updated_at();

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_members.team_id = target_team_id
      and team_members.user_id = auth.uid()
  );
$$;

create or replace function public.has_team_role(target_team_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_members.team_id = target_team_id
      and team_members.user_id = auth.uid()
      and team_members.role = any(allowed_roles)
  );
$$;

create or replace function public.join_team_with_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.team_invites%rowtype;
  normalized_code text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a workspace.';
  end if;

  normalized_code := upper(trim(invite_code));

  select * into invite_row
  from public.team_invites
  where code = normalized_code
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invite code is invalid or expired.';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (invite_row.team_id, auth.uid(), invite_row.role)
  on conflict (team_id, user_id) do nothing;

  update public.team_invites
  set used_by = auth.uid(),
      used_at = now()
  where id = invite_row.id;

  return invite_row.team_id;
end;
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.players enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_phases enable row level security;
alter table public.matches enable row level security;
alter table public.attendance enable row level security;
alter table public.player_feedback enable row level security;
alter table public.materials enable row level security;
alter table public.tactic_boards enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.winner_points enable row level security;
alter table public.external_links enable row level security;
alter table public.player_evaluations enable row level security;
alter table public.health_checkins enable row level security;
alter table public.match_analyses enable row level security;
alter table public.monday_trainings enable row level security;
alter table public.monday_attendance enable row level security;
alter table public.player_awards enable row level security;

drop policy if exists "Users can read own players" on public.players;
drop policy if exists "Users can insert own players" on public.players;
drop policy if exists "Users can update own players" on public.players;
drop policy if exists "Users can delete own players" on public.players;
drop policy if exists "Users can read own trainings" on public.training_sessions;
drop policy if exists "Users can insert own trainings" on public.training_sessions;
drop policy if exists "Users can update own trainings" on public.training_sessions;
drop policy if exists "Users can delete own trainings" on public.training_sessions;
drop policy if exists "Users can read own matches" on public.matches;
drop policy if exists "Users can insert own matches" on public.matches;
drop policy if exists "Users can update own matches" on public.matches;
drop policy if exists "Users can delete own matches" on public.matches;
drop policy if exists "Users can read own attendance" on public.attendance;
drop policy if exists "Users can upsert own attendance" on public.attendance;
drop policy if exists "Users can read own feedback" on public.player_feedback;
drop policy if exists "Users can insert own feedback" on public.player_feedback;
drop policy if exists "Users can delete own feedback" on public.player_feedback;

drop policy if exists "Team members can read teams" on public.teams;
create policy "Team members can read teams"
on public.teams for select
using (public.is_team_member(id) or created_by = auth.uid());

drop policy if exists "Users can create teams" on public.teams;
create policy "Users can create teams"
on public.teams for insert
with check (auth.uid() = created_by);

drop policy if exists "Lead coaches can update teams" on public.teams;
create policy "Lead coaches can update teams"
on public.teams for update
using (public.has_team_role(id, array['owner', 'head_coach']))
with check (public.has_team_role(id, array['owner', 'head_coach']));

drop policy if exists "Team members can read memberships" on public.team_members;
create policy "Team members can read memberships"
on public.team_members for select
using (public.is_team_member(team_id));

drop policy if exists "Team creators can add initial membership" on public.team_members;
create policy "Team creators can add initial membership"
on public.team_members for insert
with check (
  (
    auth.uid() = user_id
    and exists (
      select 1 from public.teams
      where teams.id = team_members.team_id
        and teams.created_by = auth.uid()
    )
  )
  or public.has_team_role(team_id, array['owner', 'head_coach'])
);

drop policy if exists "Lead coaches can update memberships" on public.team_members;
create policy "Lead coaches can update memberships"
on public.team_members for update
using (public.has_team_role(team_id, array['owner', 'head_coach']))
with check (public.has_team_role(team_id, array['owner', 'head_coach']));

drop policy if exists "Lead coaches can delete memberships" on public.team_members;
create policy "Lead coaches can delete memberships"
on public.team_members for delete
using (public.has_team_role(team_id, array['owner', 'head_coach']));

drop policy if exists "Team members can read invites" on public.team_invites;
create policy "Team members can read invites"
on public.team_invites for select
using (public.is_team_member(team_id));

drop policy if exists "Lead coaches can create invites" on public.team_invites;
create policy "Lead coaches can create invites"
on public.team_invites for insert
with check (auth.uid() = created_by and public.has_team_role(team_id, array['owner', 'head_coach']));

drop policy if exists "Lead coaches can delete invites" on public.team_invites;
create policy "Lead coaches can delete invites"
on public.team_invites for delete
using (public.has_team_role(team_id, array['owner', 'head_coach']));

drop policy if exists "Team members can read players" on public.players;
create policy "Team members can read players" on public.players for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert players" on public.players;
create policy "Team members can insert players" on public.players for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can update players" on public.players;
create policy "Team members can update players" on public.players for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete players" on public.players;
create policy "Team members can delete players" on public.players for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read trainings" on public.training_sessions;
create policy "Team members can read trainings" on public.training_sessions for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert trainings" on public.training_sessions;
create policy "Team members can insert trainings" on public.training_sessions for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can update trainings" on public.training_sessions;
create policy "Team members can update trainings" on public.training_sessions for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete trainings" on public.training_sessions;
create policy "Team members can delete trainings" on public.training_sessions for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read training phases" on public.training_phases;
create policy "Team members can read training phases" on public.training_phases for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert training phases" on public.training_phases;
create policy "Team members can insert training phases" on public.training_phases for insert
with check (public.is_team_member(team_id));

drop policy if exists "Team members can update training phases" on public.training_phases;
create policy "Team members can update training phases" on public.training_phases for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete training phases" on public.training_phases;
create policy "Team members can delete training phases" on public.training_phases for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read matches" on public.matches;
create policy "Team members can read matches" on public.matches for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert matches" on public.matches;
create policy "Team members can insert matches" on public.matches for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can update matches" on public.matches;
create policy "Team members can update matches" on public.matches for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete matches" on public.matches;
create policy "Team members can delete matches" on public.matches for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read attendance" on public.attendance;
create policy "Team members can read attendance" on public.attendance for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can upsert attendance" on public.attendance;
create policy "Team members can upsert attendance" on public.attendance for all
using (public.is_team_member(team_id))
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can read feedback" on public.player_feedback;
create policy "Team members can read feedback" on public.player_feedback for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert feedback" on public.player_feedback;
create policy "Team members can insert feedback" on public.player_feedback for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can delete feedback" on public.player_feedback;
create policy "Team members can delete feedback" on public.player_feedback for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read materials" on public.materials;
create policy "Team members can read materials" on public.materials for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert materials" on public.materials;
create policy "Team members can insert materials" on public.materials for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can update materials" on public.materials;
create policy "Team members can update materials" on public.materials for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete materials" on public.materials;
create policy "Team members can delete materials" on public.materials for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read tactic boards" on public.tactic_boards;
create policy "Team members can read tactic boards" on public.tactic_boards for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert tactic boards" on public.tactic_boards;
create policy "Team members can insert tactic boards" on public.tactic_boards for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can update tactic boards" on public.tactic_boards;
create policy "Team members can update tactic boards" on public.tactic_boards for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete tactic boards" on public.tactic_boards;
create policy "Team members can delete tactic boards" on public.tactic_boards for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read tasks" on public.tasks;
create policy "Team members can read tasks" on public.tasks for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert tasks" on public.tasks;
create policy "Team members can insert tasks" on public.tasks for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can update tasks" on public.tasks;
create policy "Team members can update tasks" on public.tasks for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete tasks" on public.tasks;
create policy "Team members can delete tasks" on public.tasks for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read notes" on public.notes;
create policy "Team members can read notes" on public.notes for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert notes" on public.notes;
create policy "Team members can insert notes" on public.notes for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can update notes" on public.notes;
create policy "Team members can update notes" on public.notes for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete notes" on public.notes;
create policy "Team members can delete notes" on public.notes for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read winner points" on public.winner_points;
create policy "Team members can read winner points" on public.winner_points for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert winner points" on public.winner_points;
create policy "Team members can insert winner points" on public.winner_points for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can update winner points" on public.winner_points;
create policy "Team members can update winner points" on public.winner_points for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete winner points" on public.winner_points;
create policy "Team members can delete winner points" on public.winner_points for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read external links" on public.external_links;
create policy "Team members can read external links" on public.external_links for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert external links" on public.external_links;
create policy "Team members can insert external links" on public.external_links for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can update external links" on public.external_links;
create policy "Team members can update external links" on public.external_links for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete external links" on public.external_links;
create policy "Team members can delete external links" on public.external_links for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read player evaluations" on public.player_evaluations;
create policy "Team members can read player evaluations" on public.player_evaluations for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert player evaluations" on public.player_evaluations;
create policy "Team members can insert player evaluations" on public.player_evaluations for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can update player evaluations" on public.player_evaluations;
create policy "Team members can update player evaluations" on public.player_evaluations for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete player evaluations" on public.player_evaluations;
create policy "Team members can delete player evaluations" on public.player_evaluations for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read health checkins" on public.health_checkins;
create policy "Team members can read health checkins" on public.health_checkins for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can upsert health checkins" on public.health_checkins;
create policy "Team members can upsert health checkins" on public.health_checkins for all
using (public.is_team_member(team_id))
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can read match analyses" on public.match_analyses;
create policy "Team members can read match analyses" on public.match_analyses for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can upsert match analyses" on public.match_analyses;
create policy "Team members can upsert match analyses" on public.match_analyses for all
using (public.is_team_member(team_id))
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can read monday trainings" on public.monday_trainings;
create policy "Team members can read monday trainings" on public.monday_trainings for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert monday trainings" on public.monday_trainings;
create policy "Team members can insert monday trainings" on public.monday_trainings for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can update monday trainings" on public.monday_trainings;
create policy "Team members can update monday trainings" on public.monday_trainings for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete monday trainings" on public.monday_trainings;
create policy "Team members can delete monday trainings" on public.monday_trainings for delete
using (public.is_team_member(team_id));

drop policy if exists "Team members can read monday attendance" on public.monday_attendance;
create policy "Team members can read monday attendance" on public.monday_attendance for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can upsert monday attendance" on public.monday_attendance;
create policy "Team members can upsert monday attendance" on public.monday_attendance for all
using (public.is_team_member(team_id))
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can read player awards" on public.player_awards;
create policy "Team members can read player awards" on public.player_awards for select
using (public.is_team_member(team_id));

drop policy if exists "Team members can insert player awards" on public.player_awards;
create policy "Team members can insert player awards" on public.player_awards for insert
with check (auth.uid() = user_id and public.is_team_member(team_id));

drop policy if exists "Team members can update player awards" on public.player_awards;
create policy "Team members can update player awards" on public.player_awards for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists "Team members can delete player awards" on public.player_awards;
create policy "Team members can delete player awards" on public.player_awards for delete
using (public.is_team_member(team_id));
