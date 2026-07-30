# Release Runbook

Die aktuelle Markt- und Produktbewertung steht in
[`MARKET_READINESS.md`](./MARKET_READINESS.md). Dieses Runbook beschreibt den
technischen Release-Ablauf.

## 1. Lokales Gate

Node.js 22.x (mindestens 22.12) verwenden.

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

Zusätzlich `npm run test:e2e` gegen eine isolierte Staging-Datenbank ausführen.

## 2. Staging

1. Getrennte Staging-Datenbank und getrenntes Supabase-Projekt verwenden.
2. Alle Pflichtwerte aus `.env.example` setzen.
3. `npm run db:migrate:deploy` und `npm run db:migrate:status` ausführen.
4. `supabase/migrations/20260724090000_private_media_buckets.sql` im
   Supabase SQL Editor ausführen.
5. Prüfen, dass die Prisma-Migration
   `20260724140000_storage_deletion_queue` angewendet wurde.
6. Prüfen, dass auch die Session-, Audit-, Retention-, Recovery-,
   Availability-, Billing- und Verifikationsmigrationen bis
   `20260730150000_email_verification` angewendet wurden.
7. Preview deployen und die Pilot-Flows aus `MARKET_READINESS.md` testen.

## 3. Produktion

1. Backup beziehungsweise Snapshot erstellen.
2. Produktionssecrets neu erzeugen und setzen.
3. Prisma- und Storage-Migrationen wie in Staging ausführen.
4. Nur einen bereits geprüften Commit deployen.
5. `/api/health`, Login, Spielerzugang, privaten Medienabruf, Push-Cron und
   einen vollständigen Check-in unmittelbar nach dem Deployment prüfen.
6. Passwort-Reset und E-Mail-Verifizierung mit einem echten Testpostfach
   prüfen. Bei aktiviertem Billing zusätzlich einen Stripe-Testcheckout,
   Portalaufruf und signierten Webhook vollständig durchspielen.

## 4. Rollback

- Anwendung: vorheriges geprüftes Deployment wiederherstellen.
- Datenbank: keine Migrationsdateien rückwirkend ändern. Bei Bedarf eine
  vorwärtsgerichtete Korrekturmigration erstellen.
- Storage: die Buckets nicht wieder öffentlich schalten. Fehlerhafte
  Objektpfade oder Policies vorwärts korrigieren.

Ein Release gilt erst als abgeschlossen, wenn Monitoring und Smoke-Test grün
sind und die Wiederherstellungsoption bekannt ist.

## 5. Private-Storage-Retention

Beim Entfernen oder Ersetzen einer Medienreferenz wird der zugehörige
Löschauftrag atomar in `storage_deletion_jobs` geschrieben. Die Anwendung
versucht ihn sofort auszuführen; `/api/storage/retention` wiederholt offene
Aufträge alle 15 Minuten mit exponentiellem Backoff. Vor jeder Löschung
werden die aktuellen Referenzen im selben Workspace erneut geprüft.
Neue Uploads werden ab 500 eindeutigen, referenzierten Trainingsbildern pro
Workspace serverseitig abgewiesen.

Manueller, authentifizierter Lauf:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://APP-DOMAIN/api/storage/retention
```

Die Antwort enthält nur Zähler (`claimed`, `deleted`, `referenced`,
`retried`, `discarded`). Für die Betriebskontrolle:

```sql
select count(*) as pending,
       max(attempts) as max_attempts,
       min(next_attempt_at) as oldest_due
from storage_deletion_jobs;
```

Ein dauerhaft wachsender Bestand oder wiederholte Jobs mit hohen
`attempts` erfordern die Prüfung von Supabase-Service-Role,
Bucket-Konfiguration und Runtime-Logs. Queue-Einträge nicht pauschal
löschen: Sie sind die dauerhafte Garantie für noch ausstehende Bereinigung.

## 6. Daten-Retention

`/api/data/retention` läuft täglich und verwendet die pro Workspace
konfigurierten Fristen. Der Endpunkt benötigt denselben Bearer-Wert aus
`CRON_SECRET`. Der Job löscht abgelaufene Check-ins, Nachrichten, Feedback und
Audit-Ereignisse in begrenzten, nachvollziehbaren Kategorien. Vor Produktion
Fristen mit dem Datenschutzverantwortlichen festlegen und Cron-Erfolg
überwachen.

## 7. Stripe-Aktivierung

1. Stripe-Produkt und wiederkehrenden Pro-Preis im Testmodus anlegen.
2. `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`,
   `STRIPE_WEBHOOK_SECRET` und `PRO_PRICE_DISPLAY` setzen.
3. Webhook auf `/api/stripe/webhook` für
   `checkout.session.completed` sowie
   `customer.subscription.created|updated|deleted` konfigurieren.
4. Checkout, Abbruch, Portal, Verlängerung und Kündigung testen.
5. Erst nach erfolgreicher Abnahme `BILLING_ENFORCE=true` setzen. Live-Keys
   niemals mit Test-Preis-IDs mischen.
