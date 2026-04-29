# CoachOS

A minimal football coach management MVP built with Next.js App Router, Tailwind CSS, shadcn-style components, and Supabase.

## Features

- Dashboard with next training, next match, and recent activity
- Player create, edit, delete, and profile pages
- Training session planner
- Match planner and match notes
- Attendance per training session
- Player feedback with 1-10 ratings
- Supabase auth and row-level security

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project.

3. Run `supabase/schema.sql` in the Supabase SQL editor.

4. Copy `.env.example` to `.env.local` and fill in:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

## Deploy

Deploy to Vercel and add the same environment variables in the project settings.
