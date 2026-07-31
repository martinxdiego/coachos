-- The application authorizes through NextAuth and accesses PostgreSQL only
-- through the server-side Prisma connection. Supabase's anon/authenticated
-- Data API roles must never read or mutate these tables directly.

DO $$
DECLARE
  app_table text;
  app_tables text[] := ARRAY[
    'User',
    'Workspace',
    'WorkspaceMember',
    'Player',
    'Training',
    'TrainingPhase',
    'Match',
    'MatchEvent',
    'MatchLineup',
    'MatchAnalysis',
    'Rating',
    'HealthCheck',
    'Award',
    'WinnerPoint',
    'Attendance',
    'Material',
    'TacticBoard',
    'Task',
    'Note',
    'ExternalLink',
    'MondayTraining',
    'MondayAttendance',
    'CoachMessage',
    'PlayerFeedback',
    'team_invites',
    'push_subscriptions',
    'storage_deletion_jobs'
  ];
BEGIN
  FOREACH app_table IN ARRAY app_tables LOOP
    IF to_regclass(format('public.%I', app_table)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
        app_table
      );
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM authenticated';
  END IF;
END
$$;
