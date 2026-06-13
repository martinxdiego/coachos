# Deployment & Environments (S4.5)

## Flow

```
feature-branch  →  Vercel Preview (auto per PR)  →  merge to main  →  Production
```

- **No direct pushes to `main`** — enable branch protection (require the CI
  check from `.github/workflows/ci.yml` to pass).
- Every PR gets a **Preview** deployment. Point it at a **separate staging
  database** (not production) so schema changes are exercised before prod.
- Schema/migration changes: verify on staging first, then production.

## Environments

| Var | Local | Staging | Production |
|-----|-------|---------|------------|
| `DATABASE_URL` | local/dev pooled | staging DB | prod DB |
| `DATABASE_CA_CERT` | – | Supabase CA | Supabase CA (S1.5) |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | dev project | staging project | prod project |
| `NEXT_PUBLIC_SITE_URL` | localhost:3003 | preview URL | prod domain |
| `CRON_SECRET` | – | set | set (push cron) |
| `VAPID_*` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | optional | set | set (web-push) |
| `ANTHROPIC_API_KEY` | optional | set | set (AI drafts) |
| `REDIS_URL` | optional | set | set (rate-limit/lockout/cache) |
| `SENTRY_DSN` | – | set | set (S4.3, optional) |

## Database migrations (Prisma) — see prisma/MIGRATIONS.md

The DB predates the migration history, so each existing environment must be
**baselined once**, then migrations are applied normally.

```bash
# Once per environment (prod AND staging), with that env's DATABASE_URL:
npm run db:baseline          # marks 0_init as already applied

# Then, and on every deploy thereafter:
npm run db:migrate:deploy    # applies the pending migrations in order
```

Current migration chain (all verified end-to-end on an embedded Postgres):

```
0_init
20260612120000_reduce_roles
20260613130000_add_indexes
20260613140000_consolidate_player_status
20260613150000_rename_sandu_notes
20260613160000_consolidate_duplicate_fields
20260613170000_add_match_events
```

> After baselining all environments, switch the build to run migrations:
> change `build` in package.json to
> `prisma migrate deploy && prisma generate && next build`.

## Release checklist

1. PR green in CI (typecheck, lint, tests, build).
2. Preview reviewed against staging DB; migrations applied on staging.
3. Merge to `main`.
4. `npm run db:migrate:deploy` against production.
5. Confirm `DATABASE_CA_CERT` set in prod; verify the app boots.
