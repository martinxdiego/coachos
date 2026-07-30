# CoachOS

Professional staff workspace for football coaches built with Next.js App
Router, Tailwind CSS, shadcn-style components, NextAuth, Prisma/PostgreSQL,
and private Supabase Storage.

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
- Credentials-based NextAuth, workspace membership checks, and private media
  delivery through short-lived signed URLs
- Revocable player/parent device sessions, availability replies, live squad,
  password recovery, email verification, retention policies, audit events,
  data export and deletion
- Optional Stripe Checkout/customer portal/webhook integration with
  server-enforced Free/Pro limits
- Installable responsive PWA verified on desktop, Android, iPhone and iPad

## Setup

1. Use Node.js 22.x (22.12 or newer), then install dependencies:

   ```bash
   npm install
   ```

2. Create PostgreSQL/Supabase and Redis instances for the chosen environment.

3. Set up the database schema with Prisma migrations (see
   `prisma/MIGRATIONS.md`). On an existing database, baseline once with
   `npm run db:baseline`, then `npm run db:migrate:deploy`. The data model
   lives in `prisma/schema.prisma`. (`supabase/schema.legacy.sql` is the old
   Supabase/RLS schema, kept for reference only — do not run it.)

4. Copy `.env.example` to `.env.local` and fill in all values needed for the
   enabled features. `DATABASE_URL`, `AUTH_SECRET`,
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `NEXT_PUBLIC_SITE_URL` are required for the core application. Set
   `AUTH_TRUST_HOST=true` in production only behind the trusted deployment
   proxy described in `.env.example`.

5. Apply the private Storage migration described in `docs/deploy.md`, then
   start the app:

   ```bash
   npm run dev -- --hostname 127.0.0.1 --port 3003
   ```

6. Sign in, open `/workspaces`, create or join a workspace, then use the main
   navigation.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
```
