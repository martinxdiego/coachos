# Deployment und Umgebungen

## Empfohlener Ablauf

```text
Feature-Branch → Preview mit Staging-Ressourcen → main → Produktion
```

- Preview-Deployments dürfen niemals auf die Produktionsdatenbank oder den
  produktiven Supabase-Storage zeigen.
- `main` wird durch CI und Review geschützt; keine direkten Pushes.
- Migrationen und Storage-Änderungen immer zuerst in Staging prüfen.
- Build- und Laufzeit verwenden Node.js 22.x (mindestens 22.12), wie in
  `package.json` festgelegt.

## Umgebungsvariablen

Die vollständige, kommentierte Vorlage ist `.env.example`. In Staging und
Produktion sind insbesondere erforderlich:

| Bereich | Variablen |
| --- | --- |
| Datenbank | `DATABASE_URL`, `DIRECT_URL` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Anwendung | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PRIVACY_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `COACH_SIGNUP_CODE` |
| Jobs/Push | `CRON_SECRET`, `VAPID_SUBJECT`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
| Rate-Limits | `REDIS_URL` |
| Optional | `DATABASE_CA_CERT`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `SENTRY_DSN`, `RESEND_API_KEY`, `EMAIL_FROM` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `PRO_PRICE_DISPLAY`, `BILLING_ENFORCE` |

Alle Produktions-URLs müssen HTTPS verwenden. `SUPABASE_SERVICE_ROLE_KEY`,
`AUTH_SECRET`, `CRON_SECRET`, `VAPID_PRIVATE_KEY` und Datenbankwerte dürfen nie
als `NEXT_PUBLIC_*` gesetzt werden.

`AUTH_TRUST_HOST=true` ist für den Produktions-Host erforderlich. Es darf nur
hinter einem vertrauenswürdigen Proxy gesetzt werden, der `Forwarded` und
`X-Forwarded-Host` selbst überschreibt; bei Vercel ist diese Host-Grenze Teil
der Plattform.

`DATABASE_CA_CERT` ist nur ein optionaler CA-Override; ohne Wert verwendet die
App das mitgelieferte Supabase-Root-Zertifikat. Ein eigener PEM-Wert kann echte
Zeilenumbrüche oder literale `\n` enthalten. Die App normalisiert beide Formen.

## Datenbank

Bei einer bestehenden Datenbank, die vor der Prisma-Historie angelegt wurde,
einmalig die Baseline nach `prisma/MIGRATIONS.md` setzen. Danach pro Umgebung:

```bash
npm run db:migrate:deploy
npm run db:migrate:status
```

Für Migrationen die direkte Verbindung aus `DIRECT_URL` verwenden, nicht den
PgBouncer-Transaktionspool.

Die Migration `20260724150000_lock_down_public_schema` aktiviert RLS auf allen
Prisma-App-Tabellen und entzieht Supabase `anon`/`authenticated` die
Data-API-Rechte. Nach dem Deploy mit dem öffentlichen Anon-Key prüfen, dass
beispielsweise `User`, `Player` und `HealthCheck` weder gelesen noch
geschrieben werden können. Die Anwendung selbst verwendet dafür keine
Supabase-Client-Policy, sondern die serverseitige Prisma-Verbindung.

## Privater Storage

Im Supabase SQL Editor ausführen:

```text
supabase/migrations/20260724090000_private_media_buckets.sql
```

Danach kontrollieren:

- `player-photos` und `training-images` haben `public = false`.
- Es existieren keine alten Public-Read- oder pauschalen Upload-Policies.
- Upload, signierter Abruf, Ersetzen und Löschen funktionieren in Staging.
- Alte öffentliche Objekt-URLs sind nicht mehr erreichbar.

## Cron

`vercel.json` startet `/api/push/daily` täglich um `07:00 UTC`,
`/api/data/retention` täglich um `02:30 UTC` und die private
Storage-Bereinigung alle 15 Minuten. Vercel sendet den Wert aus
`CRON_SECRET` als Bearer-Token. Ein manueller Test muss denselben
Authorization-Header verwenden; die Antworten enthalten nur Aggregatwerte.

## Release und Rollback

Das verbindliche Gate sowie Smoke-Test und Rollback stehen in
[`RELEASE_RUNBOOK.md`](./RELEASE_RUNBOOK.md). Die noch notwendigen
Marktfreigaben stehen in [`MARKET_READINESS.md`](./MARKET_READINESS.md).
