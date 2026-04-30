# CoachOS

Professional staff workspace for football coaches built with Next.js App
Router, Tailwind CSS, shadcn-style components, and Supabase.

## Features

- Workspace-first structure with workspace create, switch, and invite codes
- Modern dashboard with next training, next match, metrics, tasks, activity,
  quick actions, material, and tactic board overview
- Fast player creation plus detailed player profiles
- Training planner with metadata, intensity, attendance, AI draft action, and
  structured phases
- Match planner with squad notes, formation preview, lineup, result, goals, and
  review notes
- Material area for printable training plans, match plans, tactic sheets, lists,
  week plans, and month plans
- Interactive tactic board MVP with pitch, players, opponents, ball, cones,
  arrows, text notes, drag-and-drop, save, and print flow
- Calendar overview for trainings and matches
- Supabase auth and team-member row-level security

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project.

3. Run `supabase/schema.sql` in the Supabase SQL editor. The schema creates
   workspaces, memberships, invite codes, players, trainings, training phases,
   matches, materials, tactic boards, tasks, notes, attendance, feedback, and
   RLS policies.

4. Copy `.env.example` to `.env.local` and fill in:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   NEXT_PUBLIC_SITE_URL=http://localhost:3003
   ```

5. Start the app:

   ```bash
   npm run dev -- --hostname 127.0.0.1 --port 3003
   ```

6. Sign in, open `/workspaces`, create or join a workspace, then use the main
   navigation.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```
