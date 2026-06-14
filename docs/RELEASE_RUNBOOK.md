# Release Runbook — epic-4-robustness → main

One authoritative, ordered checklist for shipping the current integration
branch. Companion docs: environment matrix & migration mechanics live in
[`deploy.md`](./deploy.md); error monitoring in [`observability.md`](./observability.md).
This file is release-specific — it ties those together with the exact
commands and the smoke test for *this* release.

> Status at time of writing: `epic-4-robustness` is the single integration
> branch (sprint-1-security, sprint-2-datalayer, epic-3-schema, sprint-4-tests
> are all ancestors). It is **49 commits ahead of `origin/main`, zero behind**,
> and `main` is an ancestor — so the merge is a clean fast-forward, no conflicts.

## What's in this release

- **EPIC 1** security: multi-tenant isolation, hard-cutover team-join (TeamInvite
  codes only), roles OWNER/COACH/ASSISTANT, login throttle, DB CA cert (S1.5).
- **EPIC 2** data-layer cleanup; **EPIC 3** schema consolidation
  (7-migration chain); **EPIC 4** robustness (error boundaries, structured
  logging, tests, deploy docs).
- **EPIC 5** i18n: next-intl in cookie-based no-routing mode, German default
  with an English foundation. Entire externally-shared surface (public auth,
  team-join, player self-register, player `/p` home + all player cards) plus
  coach dashboard, quick-create, confirm dialog and coach-messaging are
  bilingual. Catalogs verified at **333 keys, DE/EN parity**.

## Pre-merge gate

- [ ] CI green on the branch (typecheck, lint, **43 unit tests**, build) —
      `.github/workflows/ci.yml`.
- [ ] Local sanity: `npx tsc --noEmit` clean and `npx vitest run` all green.
- [ ] Catalog parity holds (no orphan keys DE vs EN). Quick check is the
      flatten-and-diff snippet used during the i18n work; CI build also fails
      on a missing default-locale key.

## Step 1 — Merge to main (fast-forward)

```bash
git checkout main
git merge --ff-only epic-4-robustness   # fast-forward, no merge commit
```

If `--ff-only` ever refuses, `main` has gained commits — rebase the branch
first; do **not** force.

## Step 2 — Push (outward-facing — requires your go-ahead)

```bash
git push origin main
```

This is the first outward-facing action. `origin/main` currently trails by
49 commits; pushing publishes the whole release. Confirm before running.

## Step 3 — Branch protection (one-time, GitHub UI)

- [ ] Settings → Branches → protect `main`: require the CI status check,
      require PR review, disallow direct pushes. (Matches `deploy.md` policy:
      "No direct pushes to `main`".)

## Step 4 — Database migrations

The DB predates the migration history → **baseline each environment once**,
then deploy migrations. Full detail in `deploy.md` and `prisma/MIGRATIONS.md`.

> ⚠️ **Set `DIRECT_URL` first.** Prisma migrate needs a direct connection
> (port 5432). Supabase's pooled `DATABASE_URL` (PgBouncer, port 6543) makes
> `migrate` hang. Set `DIRECT_URL` to the direct connection string per
> environment; `prisma.config.ts` uses it automatically (falls back to
> `DATABASE_URL`). See `prisma/MIGRATIONS.md`.

```bash
# Once per environment (STAGING first, then PRODUCTION), with that env's DATABASE_URL:
npm run db:baseline           # = prisma migrate resolve --applied 0_init
npm run db:migrate:deploy     # applies the remaining 6 migrations in order
npm run db:migrate:status     # expect: "Database schema is up to date"
```

Order matters: **staging → verify → production**. The 7-migration chain
(`0_init` → … → `20260613170000_add_match_events`) is listed in `deploy.md`
and was verified end-to-end on embedded Postgres (PGlite).

- [ ] Staging baselined + migrated + status clean.
- [ ] Smoke test on staging (Step 6) passes.
- [ ] Production baselined + migrated + status clean.

> After **all** environments are baselined, switch the build to self-migrate:
> set `build` in `package.json` to
> `prisma migrate deploy && prisma generate && next build` (per `deploy.md`).
> Until then, run `db:migrate:deploy` manually on each prod deploy.

## Step 5 — Environment variables (Vercel)

Cross-check the matrix in `deploy.md`. Release-critical:

- [ ] `DATABASE_CA_CERT` set in **production** (S1.5 — TLS to Supabase).
- [ ] `REDIS_URL` set (rate-limit / login lockout / cache; app degrades to
      in-memory without it, but production should have it).
- [ ] `CRON_SECRET`, `VAPID_*` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` set if push is on.
- [ ] Optional: `SENTRY_DSN` + the `instrumentation.ts` step from
      `observability.md` (error aggregation; nothing is lost without it —
      `captureException` still logs).

**i18n needs no new env var.** Locale is cookie-based (`NEXT_LOCALE`), default
`de`, lenient fallback. The English foundation ships dormant until a user
switches via the language switcher.

## Step 6 — Post-deploy smoke test

- [ ] App boots; coach login works; active workspace loads.
- [ ] **Hard-cutover check:** an old UUID team-join link is dead; a fresh
      `TeamInvite` code works (EPIC 1 / S1.3).
- [ ] Player `/p/<token>` home renders; submit a check-in; send a note to coach.
- [ ] Coach dashboard: quick-create FAB creates a training; wellness check saves.
- [ ] Coach sends a message to a player → appears in the player inbox with the
      right category label.
- [ ] **Locale check:** flip `NEXT_LOCALE` to `en` (or the switcher) and
      reload the public/login + player pages — strings render in English, no
      raw keys, no console `MISSING_MESSAGE`.
- [ ] Migration-touched data reads correctly: player status
      (AVAILABLE/LIMITED/INJURED/ABSENT), match events, assistant notes.

## Rollback

- **App:** Vercel → promote the previous production deployment (instant).
- **DB:** the chain is additive/transform — no destructive drops in the 6
  applied migrations, so an app rollback is safe without a DB rollback. If a
  specific migration must be undone, write a forward "revert" migration rather
  than editing history.

## Deferred (not blocking this release)

- S5.2 tail: coach-internal-only strings (create-drawers, rosters,
  winner-points panel, tactic editors) and server-action/push/PDF labels.
  These are German-only today and only a German-speaking coach sees them.
- S5.4: unified i18n error format — depends on the action-error-message
  extraction above.
