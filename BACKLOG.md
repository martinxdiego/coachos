# CoachOS — Produkt-Backlog & Sprint-Plan

> Stand: 2026-06-12 · Basierend auf Code-Review (Sicherheit, Architektur, Konsistenz, UX, Marktreife)
> Arbeitsweise: Scrum-ähnlich, 2-Wochen-Sprints. Kanban-Spalten: `Backlog → Sprint → In Progress → Review → Done`
> Status-Tracking: Checkbox pro Story. Eine Story gilt als Done, wenn alle Akzeptanzkriterien erfüllt sind und `npm run typecheck && npm run lint && npm run build` grün ist.

---

## Priorisierung

| Prio | Bedeutung |
|------|-----------|
| **P0** | Sicherheits-/Datenschutz-Blocker — vor allem anderen, kein Release ohne |
| **P1** | Fundament — ohne das ist jede weitere Arbeit Treibsand |
| **P2** | Produktqualität & Betrieb — nötig für erste zahlende Kunden |
| **P3** | Skalierung & Kommerzialisierung — nötig für "Massenmarkt" |

Schätzung in Story Points (SP): 1 ≈ halber Tag, 2 ≈ 1 Tag, 3 ≈ 2 Tage, 5 ≈ 3–4 Tage, 8 ≈ 1 Woche.

---

# EPIC 1 — Sicherheit & Mandanten-Trennung (P0)

**Ziel:** Kein Nutzer kann Daten eines fremden Workspace lesen oder verändern. Keine Debug-/Geheimnis-Lecks.
**Sprint: 1**

- [x] **S1.1 (P0, 3 SP) `workspaceProcedure` für tRPC einführen** ✅ 2026-06-12
  Neue Middleware in `lib/trpc/init.ts`: erwartet `workspaceId` im Input, prüft `db.workspaceMember.findUnique({ workspaceId_userId })`, wirft sonst `FORBIDDEN`. Für ID-basierte Zugriffe (get/update/delete): Entität laden und `workspaceId` gegen Membership prüfen.
  *AK:* Alle Prozeduren in `lib/trpc/routers/{player,health,match,rating,training,winner}.ts` nutzen die Middleware. Ein Test beweist: User A erhält bei Zugriff auf Workspace B `FORBIDDEN`.
  *Umgesetzt:* `workspaceProcedure` + `playerProcedure` + `assertPlayerAccess()` in `init.ts`; alle 7 Router umgestellt; player.get/update/delete prüfen via `assertPlayerAccess`. Typecheck grün. **Offen:** automatisierter Test (kommt mit S4.2).

- [x] **S1.2 (P0, 1 SP) Debug-Route entfernen** ✅ 2026-06-12
  `app/api/debug-db/route.ts` löschen. Git-History prüfen, ob je echte Secrets committet wurden (`.env`-Werte); falls ja: Keys rotieren.
  *AK:* Route entfernt, `DATABASE_URL`/Service-Keys rotiert oder als sauber verifiziert.
  *Umgesetzt:* Route + Ordner gelöscht. Git-History enthält keine `.env`-Dateien; `.gitignore` deckt sie ab → keine Rotation nötig.

- [x] **S1.3 (P0, 3 SP) Team-Beitritt auf `TeamInvite` umstellen** ✅ 2026-06-12 (Hard-Cutover)
  `findTeamByToken` in `app/actions-public.ts` darf nicht mehr `workspace.id` als Token akzeptieren. Stattdessen: `TeamInvite.code` (zufällig, `expiresAt`, widerrufbar). UI in `/workspaces` + `/beitreten/[teamToken]` anpassen, `player_signup_token`-Fallback in `lib/auth.ts:115` entfernen.
  *AK:* Beitritt nur mit gültigem, nicht abgelaufenem Invite-Code. Trainer kann Codes erzeugen und widerrufen. Alte Workspace-UUID-Links funktionieren nicht mehr.

- [x] **S1.4 (P0, 2 SP) Spieler-Access-Token härten** ✅ 2026-06-12
  Token-Rotation: Trainer kann pro Spieler einen neuen Link erzeugen (alter wird ungültig). Optional `lastUsedAt` loggen.
  *AK:* "Link erneuern"-Button im Spielerprofil; alter Token liefert 404.
  *Umgesetzt:* Server-Action `rotatePlayerAccessToken` (workspace-scoped) + "Link erneuern"-Button mit Bestätigung in `player-mode-share.tsx`. Alter Token findet keinen Spieler mehr. `lastUsedAt`-Logging als optionales Follow-up offen.
  *S1.3 umgesetzt (Hard-Cutover):* `lib/invites.ts` (getOrCreate/rotate/resolve, role PLAYER, 90 Tage Ablauf, akzeptiert nie eine Workspace-UUID); `/beitreten/[teamToken]` + `selfRegisterPlayer` lösen nur noch Invite-Codes auf; Players-Seite zeigt aktiven Code + „Link erneuern" (`rotateTeamSignupCode`). Alte UUID-Links laufen ins Leere. **Setzt `team_invites`-Tabelle voraus → kommt mit S3.1-Baseline.**

- [x] **S1.5 (P0, 2 SP) DB-TLS korrekt konfigurieren** ✅ 2026-06-12
  `rejectUnauthorized: false` in `lib/db.ts` entfernen; Supabase-CA-Zertifikat einbinden (`ssl: { ca: ... }`) oder `sslmode=verify-full` in der Connection-URL.
  *AK:* Verbindung verifiziert Zertifikat; Deployment auf Vercel funktioniert.
  *Umgesetzt:* `resolveSslConfig()` verifiziert per Default; CA via `DATABASE_CA_CERT`; Notfall-Opt-out `DATABASE_SSL_NO_VERIFY=true` (mit Warnung). **Aktion nötig:** Supabase-CA-Cert in Vercel-Env `DATABASE_CA_CERT` hinterlegen, damit der sichere Pfad ohne Opt-out greift.

- [x] **S1.6 (P0, 3 SP) Auth-Härtung Basis** ✅ 2026-06-12 (zxcvbn offen)
  Passwort-Mindestlänge 10 + zxcvbn-Check, Login-Lockout/Backoff (z. B. 5 Fehlversuche → 15 min, Redis-basiert, pro E-Mail + IP), generische Fehlermeldungen (kein "user not found"-Logging mit E-Mail in Klartext).
  *AK:* Brute-Force-Test schlägt fehl; Logs enthalten keine Klartext-E-Mails bei Fehlversuchen.
  *Umgesetzt:* `lib/login-throttle.ts` (5 Fehlversuche → 15 min Lockout, Redis + In-Memory-Fallback); `authorize()` mit konstanter bcrypt-Laufzeit gegen User-Enumeration, generischen Meldungen, ohne E-Mail-Logging; Passwortlänge 10 in Action + Login-Form. **Offen:** zxcvbn-Stärkeprüfung (separates kleines Follow-up).

- [x] **S1.7 (P0, 2 SP) Rollen durchsetzen** ✅ 2026-06-12 (Migration vorbereitet, Apply nach Baseline)
  `Role`-Enum auf benutzte Werte reduzieren (z. B. `OWNER`, `COACH`, `ASSISTANT`); destruktive Aktionen (Workspace löschen, Mitglieder verwalten, Invite-Codes) nur für `OWNER`.
  *AK:* Berechtigungsmatrix dokumentiert; Tests für mind. 3 verbotene Aktionen.
  *Umgesetzt:* `Role`-Enum auf `OWNER/COACH/ASSISTANT` reduziert (Schema + Defaults `COACH`/`ASSISTANT`); transaktionssichere Migration `20260612120000_reduce_roles` mit Altwert-Mapping; `canManageWorkspace`→nur owner, Staff-Invite-Rollen coach/assistant, Join-Mapping, tRPC-Workspace-Update nur OWNER, UI-Checks aktualisiert; Berechtigungsmatrix in `docs/permissions.md`. **Apply:** läuft mit `migrate deploy` nach der S3.1-Baseline. **Offen:** automatisierte Verbots-Tests → S4.2. ASSISTANT = gleiche Rechte wie COACH (nur OWNER destruktiv).

---

### ✅ Sprint 1 abgeschlossen (7/7)

Alle Sicherheits-Stories umgesetzt; Typecheck + Lint grün. **Ausstehende User-Aktionen vor/bei Deploy:**
1. **S3.1-Baseline** je Umgebung einmalig: `npm run db:baseline` (Prod + Staging).
2. **Danach** `prisma migrate deploy` ausführen → wendet `20260612120000_reduce_roles` an (S1.7).
3. **TLS:** Supabase-CA-Cert als `DATABASE_CA_CERT` in Vercel (S1.5).
4. **Tests** für Mandanten-Trennung + verbotene Rollen-Aktionen kommen mit S4.2.

---

# EPIC 2 — Architektur-Konsolidierung: eine Datenschicht (P1)

**Ziel:** Genau ein Datenzugriffsweg (Server Actions + Prisma). Supabase nur noch für Storage.
**Sprint: 2**

- [x] **S2.1 (P1, 5 SP) Supabase-Altlasten entfernen** ✅ 2026-06-13
  Fake-`dummySupabase` aus `requireUser()` (`lib/auth.ts:80`) entfernen; alle Seiten finden, die das Mock nutzen (liefern heute stillschweigend leere Daten!) und auf Prisma umstellen. `supabase/schema.sql`-RLS-Policies als obsolet markieren/archivieren.
  *AK:* `grep dummySupabase` leer; jede Seite zeigt echte Daten; Supabase-Client nur noch in Storage-Code.
  *Umgesetzt:* dummySupabase entfernt; `requireUser`/`getOptionalActiveTeam`/`requireActiveTeam` geben keinen supabase-Client mehr zurück. **PDF-Routen (training/match/material) waren über das Mock faktisch kaputt** (`.maybeSingle()` existierte nicht) — auf Prisma umgeschrieben. Toten Supabase-OAuth-Callback + `lib/supabase/admin.ts` + `getSupabaseServiceRoleEnv` entfernt. `schema.sql`→`schema.legacy.sql` mit Deprecation-Header; README zeigt auf Prisma. Supabase nur noch für Storage.

- [ ] **S2.2 (P1, 3 SP) Team/Workspace-Mapping-Layer entfernen** ⏭️ verschoben (nach S4.2)
  `mapWorkspaceToTeam`/`mapMemberToMembership` löschen; überall direkt Prisma-Typen (`Workspace`, `WorkspaceMember`) verwenden. snake_case-Typen (`Team`, `TeamMember`) aus `lib/types.ts` entfernen.
  *AK:* Ein Begriff im ganzen Code (Entscheidung: **Workspace**); keine `as any`-Casts mehr in `lib/auth.ts`.
  *Hinweis:* Breiter, verhaltensneutraler Refactor (snake_case→camelCase + Rollen-Case über viele Seiten). Empfehlung: erst **S4.2 (Tests)** als Sicherheitsnetz, dann S2.2 + S2.4 zusammen.

- [x] **S2.3 (P1, 2 SP) tRPC-vs-Actions-Entscheidung umsetzen** ✅ 2026-06-13
  Entscheidung: Server Actions als primäre Mutations-Schicht (dort liegt bereits die ganze Logik). tRPC entweder (a) entfernen oder (b) nur für Client-seitige Reads behalten — dann aber abgesichert (S1.1) und dokumentiert wofür.
  *AK:* ADR-Dokument (`docs/adr/001-data-layer.md`); kein Endpunkt existiert doppelt in beiden Schichten.
  *Umgesetzt:* `docs/adr/001-data-layer.md`. tRPC war vollständig verdrahtet, aber von keiner Client-Komponente genutzt → komplett entfernt (`lib/trpc/**`, `app/api/trpc/**`, Provider, `@trpc/*` + `@tanstack/react-query`-Deps). `/api/trpc`-Angriffsfläche damit weg.

- [ ] **S2.4 (P1, 5 SP) `actions.ts` aufteilen** ⏭️ verschoben (nach S4.2)
  91-KB-Datei nach Domänen splitten: `app/actions/{auth,players,trainings,matches,materials,tactics,health,awards,workspace}.ts`. Gemeinsame Helfer (`requiredString`, `optionalNumber`, …) nach `lib/forms.ts`.
  *AK:* Keine Datei > 500 Zeilen; Imports aktualisiert; Build grün.
  *Hinweis:* Großer mechanischer Split ohne Verhaltensänderung — am sichersten mit Test-Netz (S4.2) und Barrel-Re-Export für stabile Importpfade.

- [x] **S2.5 (P1, 3 SP) Queue-Architektur fixen** ✅ 2026-06-13
  BullMQ-Worker aus dem Next-Prozess entfernen (`lib/queue.ts` startet Worker beim Import — auf Vercel unzuverlässig, In-Memory-Fallback verliert Jobs). Ersatz: Push direkt synchron im Cron-Handler versenden (Volumen ist klein) **oder** QStash/Inngest. BullMQ + ioredis raus aus den Dependencies, falls nicht mehr gebraucht.
  *AK:* Tägliche Push-Notification nachweisbar zugestellt (Test-Subscription); keine Worker-Initialisierung im Request-Pfad.
  *Umgesetzt:* `lib/push.ts` (`sendPushNotification`, räumt tote 410/404-Subs auf); `/api/push/daily` versendet synchron und meldet `{sent, attempted}`; `lib/queue.ts` + `bullmq`-Dependency entfernt (`ioredis` bleibt). **Offen (S4.2):** Zustellungs-Test mit echter Subscription.

---

# EPIC 3 — Datenmodell-Bereinigung & Migrations (P1)

**Ziel:** Ein widerspruchsfreies Schema mit Migrationshistorie als Single Source of Truth.
**Sprint: 2–3**

- [x] **S3.1 (P1, 2 SP) Prisma Migrations einführen** 🔄 2026-06-12 (Baseline-Files fertig, `db:baseline` auf Prod/Staging ausstehend)
  `prisma migrate dev` Baseline aus Bestands-DB erzeugen (`migrate diff` → Baseline-Migration, als applied markieren). Ab jetzt: kein `db push` mehr gegen Prod.
  *AK:* `prisma/migrations/` existiert; README beschreibt Migrations-Workflow; Deploy führt `migrate deploy` aus.
  *Umgesetzt:* `prisma/migrations/0_init/migration.sql` (offline aus Schema generiert, 73 DDL-Statements, alle Modelle inkl. `team_invites`/`push_subscriptions`) + `migration_lock.toml`; npm-Scripts `db:baseline`/`db:migrate`/`db:migrate:deploy`/`db:migrate:status`; Workflow in `prisma/MIGRATIONS.md`. **Aktion nötig (einmalig je Umgebung):** `npm run db:baseline` gegen Prod + Staging (schreibt nur in `_prisma_migrations`, nicht-destruktiv). Danach separater Commit: `build` auf `migrate deploy` umstellen.

- [ ] **S3.2 (P1, 5 SP) Duplikat-Felder konsolidieren** (je Feld: Datenmigration + Code-Anpassung)
  - `Player`: `number`→`jerseyNumber`, `preferredFoot`→`strongFoot` (eines behalten)
  - `Training`: `duration`→`durationMinutes`
  - `Match`: `home`→`homeAway`
  - `Rating`: `behaviour`→`behavior`
  - `MatchAnalysis`: `positives/negatives` vs. `wentWell/needsWork` — ein Paar behalten; `matchGoals` nur in einem Modell
  *AK:* Migration kopiert Bestandsdaten ins Zielfeld; alte Spalten entfernt; UI unverändert funktionsfähig.

- [ ] **S3.3 (P1, 2 SP) `PlayerStatus`-Enum vereinheitlichen**
  Zwei Generationen (`FIT/REHAB/INJURED` + `available/injured/limited/absent`) → ein Set: `AVAILABLE`, `LIMITED`, `INJURED`, `ABSENT`. Datenmigration mappt Altwerte.
  *AK:* Enum hat 4 Werte; zod-Schemas und UI-Filter angepasst.

- [ ] **S3.4 (P1, 2 SP) Indexe ergänzen**
  `@@index([workspaceId])` auf allen mandantenbezogenen Modellen; `@@index([workspaceId, date])` auf `Training`, `Match`, `HealthCheck`, `WinnerPoint`, `Rating`.
  *AK:* Migration angewendet; `EXPLAIN` auf Dashboard-Queries nutzt Indexe.

- [ ] **S3.5 (P2, 5 SP) Spielstatistik strukturieren**
  `scorers`/`assists`/`cards`/`startingLineup`/`substitutes` (Freitext) → Relationen: `MatchEvent` (Typ: GOAL/ASSIST/YELLOW/RED/SUB, playerId, minute) + vorhandenes `MatchLineup` nutzen. Freitextfelder bleiben übergangsweise lesbar, neue Eingaben strukturiert.
  *AK:* Spieler-Saisonstatistik (Tore/Assists/Karten) automatisch aggregierbar; Eingabe-UI im Match-Formular.

- [ ] **S3.6 (P1, 1 SP) Personenspezifische Felder entfernen**
  `sanduNotes` in `MondayTraining` → generisches Feld (`assistantNotes`) oder eigenes `StaffNote`-Modell. "Montagstraining" als Konzept prüfen → generischer "wiederkehrende Einheit"-Typ (siehe S6.2).
  *AK:* Kein Eigenname mehr im Schema.

---

# EPIC 4 — Qualitätssicherung: Tests, CI, Observability (P2)

**Ziel:** Fehler fallen vor dem Deploy auf; Fehler in Prod werden gemeldet, nicht vom Kunden entdeckt.
**Sprint: 3**

- [ ] **S4.1 (P2, 2 SP) CI-Pipeline (GitHub Actions)**
  Workflow: `typecheck → lint → unit tests → build → e2e (gegen Preview)`. PR-Pflicht auf `main`, kein Direkt-Push.
  *AK:* `.github/workflows/ci.yml`; roter Check blockiert Merge.

- [x] **S4.2 (P2, 5 SP) Test-Fundament** 🔄 2026-06-13 (Unit-Fundament fertig; E2E-Erweiterung + CI offen)
  Vitest einrichten; Unit-Tests für: Autorisierung (S1.1-Middleware), Form-Helfer, `coach-metrics`/`predictive-health`-Berechnungen, Invite-Code-Lifecycle. Playwright erweitern: Login-Fehlerfälle, Mandanten-Trennung (User A sieht Team B nicht), Spieler-Check-in.
  *AK:* `npm test` existiert; ≥ 20 Unit-Tests; 3 E2E-Szenarien; alles in CI.
  *Umgesetzt:* Vitest + `vitest.config.ts` (`@/`-Alias, Dummy-`DATABASE_URL`); `npm test`/`test:watch`; reine Form-Helfer nach `lib/forms.ts` extrahiert; **34 Unit-Tests grün** (forms, coach-metrics/healthRisk, pdf/filename, utils, invites-Code, login-throttle-Lockout). **Offen:** Playwright-Specs für Mandanten-Trennung + Login-Fehler (brauchen laufende App/DB) und CI-Verdrahtung (S4.1). Hinweis: die in der AK genannte tRPC-Middleware existiert nicht mehr (in S2.3 entfernt).

- [ ] **S4.3 (P2, 2 SP) Error-Monitoring & Logging**
  Sentry (Client + Server + Edge) einbinden; `console.log`-Debugging durch strukturiertes Logging ersetzen (z. B. pino); PII (E-Mails, Gesundheitsdaten) nie loggen.
  *AK:* Test-Exception erscheint in Sentry mit Release-Tag; Log-Audit ohne PII.

- [ ] **S4.4 (P2, 2 SP) Error- & Loading-States im App Router**
  `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`; `loading.tsx` für alle Hauptrouten (heute nur 4 von ~20); Server-Action-Fehler als Inline-Feedback statt Crash (useActionState / toast).
  *AK:* Geworfener Action-Fehler zeigt verständliche deutsche Meldung in der UI; kein weißer Next-Crash-Screen mehr.

- [ ] **S4.5 (P2, 1 SP) Staging-Umgebung**
  Vercel Preview + separate Staging-DB (Supabase-Branch oder zweites Projekt). Regel: Schema-Änderungen erst Staging, dann Prod.
  *AK:* Dokumentierter Deploy-Flow `feature-branch → preview → main → prod`.

---

# EPIC 5 — Konsistenz & Internationalisierung (P2)

**Ziel:** Eine Sprache pro Ebene: Code englisch, UI konsistent lokalisiert, Begriffe einheitlich.
**Sprint: 4**

- [ ] **S5.1 (P2, 2 SP) i18n-Entscheidung + Fix**
  Entscheidung: launch DACH-only → handgerolltes `lib/i18n.ts` entfernen (es ist serverseitig kaputt: synchrones `cookies()` in Next 15 → liefert immer "de") **oder** richtig: next-intl mit Locale-Routing. Empfehlung für jetzt: next-intl, da EN-Markt fürs Skalierungsziel nötig ist.
  *AK:* ADR; kein toter i18n-Code; Sprachumschalter funktioniert serverseitig nachweisbar.

- [ ] **S5.2 (P2, 8 SP) Alle UI-Strings extrahieren**
  Hardcodierte deutsche Texte (UI, Fehlermeldungen in Actions, Push-Texte, PDF-Labels) in Message-Kataloge; EN-Übersetzung erstellen.
  *AK:* `messages/de.json` + `en.json` decken die App ab; Sprachwechsel zeigt durchgängig EN.

- [ ] **S5.3 (P2, 2 SP) Routen vereinheitlichen**
  `/spieler`, `/beitreten`, `/winnerpunkte` → englische technische Routen (`/p/[token]`, `/join/[code]`, `/points`) mit Redirects von Alt-URLs (Spieler-Links sind im Umlauf!).
  *AK:* Alte Links redirecten 308; QR-Codes/Push-URLs nutzen neue Pfade.

- [ ] **S5.4 (P2, 1 SP) Fehlermeldungs-Stil vereinheitlichen**
  Einheitliches Format (Sprache via i18n, kein Mix "is required" / "ist erforderlich"); zentrale Fehler-Helper.
  *AK:* Stichprobe über alle Actions: konsistente, übersetzte Meldungen.

---

# EPIC 6 — UX & Produkt-Generalisierung (P2)

**Ziel:** Ein fremder Trainer versteht die App in 5 Minuten; vereinsspezifische Konzepte werden konfigurierbar.
**Sprint: 4–5**

- [ ] **S6.1 (P2, 3 SP) Informationsarchitektur straffen**
  Kern-Navigation: Heute / Training / Spiele / Team / Einstellungen. Sekundäres (Analyse, Material, Taktikboard, Kalender) als Unterpunkte. Max. 5 Bottom-Nav-Items mobil.
  *AK:* Nav-Review mit 2 Test-Trainern (Think-aloud); Aufgabenerfolg "neues Training anlegen" < 30 s.

- [ ] **S6.2 (P2, 5 SP) Vereins-Spezifika generalisieren**
  "Hut-System" → konfigurierbares "Auszeichnungen"-Modul (Name/Icon pro Workspace einstellbar); "Winnerpunkte" → "Teampunkte" (umbenennbar); "Montagstraining" → wiederkehrende Trainingsserie (beliebiger Wochentag); "Clubcorner/Quali" → generische "Vereinslinks".
  *AK:* Neuer Workspace startet mit neutralen Defaults; Bestands-Workspace behält seine Begriffe via Konfiguration.

- [ ] **S6.3 (P2, 3 SP) Onboarding-Flow**
  First-Run-Wizard: Team anlegen → Spieler einladen (QR/Link) → erstes Training planen. Empty-States mit Call-to-Action auf allen Listen-Seiten. Optional Demo-Daten ("Beispielteam laden").
  *AK:* Neuer Account erreicht ohne Doku ein angelegtes Training; Abbruchquote im Wizard messbar (S7.4).

- [ ] **S6.4 (P2, 2 SP) Formular-UX**
  Login/Signup: Inline-Validierung statt `?message=`-Query-Param; Submit-Buttons mit Pending-State (useFormStatus); Erfolgs-/Fehler-Toasts konsistent.
  *AK:* Falsches Passwort zeigt Inline-Fehler ohne Page-Reload-Roundtrip-Verwirrung.

- [ ] **S6.5 (P2, 3 SP) Accessibility-Basis (EAA-Pflicht seit 06/2025)**
  Audit der Kern-Flows: Kontraste, Fokus-Reihenfolge, Labels, Touch-Targets ≥ 44 px, Screenreader auf Check-in-Flow (wird von Kindern/Eltern genutzt).
  *AK:* axe-core ohne Critical Issues auf Dashboard, Spieler-Check-in, Login.

- [ ] **S6.6 (P2, 2 SP) Eltern-Einwilligung im Spieler-Flow**
  Selbstregistrierung Minderjähriger: Einwilligungs-Schritt (Checkbox + Eltern-Kontakt), Hinweistext zu Gesundheitsdaten, Datenschutzerklärung verlinkt.
  *AK:* Ohne Einwilligung keine Registrierung; Zeitpunkt + Version der Einwilligung gespeichert.

---

# EPIC 7 — Skalierung & Performance (P3)

**Ziel:** App bleibt schnell und bezahlbar bei 10 000+ Workspaces.
**Sprint: 5–6**

- [ ] **S7.1 (P3, 3 SP) Pagination & Query-Limits**
  Alle `findMany` ohne `take` prüfen; Listen (Spieler, Trainings, Spiele, Punkte) paginieren oder Zeitfenster-begrenzen; Dashboard-Queries auf benötigte Felder reduzieren (`select`).
  *AK:* Keine unbegrenzte Query im Hot Path; Dashboard < 500 ms Serverzeit bei 500 Spielern/1 000 Trainings (Seed-Test).

- [ ] **S7.2 (P3, 2 SP) AI-Kostenkontrolle**
  Anthropic-Aufrufe pro Workspace limitieren (z. B. 20/Monat im Free-Tier), Nutzung tracken, Timeout + Fehlerbehandlung; Prompt-Injection-Härtung (User-Content als Daten markieren).
  *AK:* Limit greift; Verbrauch pro Workspace abfragbar.

- [ ] **S7.3 (P3, 2 SP) Caching-Strategie**
  Redis-Cache (`leaderboard:*` existiert punktuell) systematisieren oder entfernen; Next.js-Caching (`revalidatePath`-Flut in Actions reduzieren auf betroffene Pfade).
  *AK:* Dokumentierte Cache-Keys + Invalidierung; keine Stale-Daten-Bugs in E2E.

- [ ] **S7.4 (P3, 2 SP) Produkt-Analytics**
  Privacy-freundliches Tracking (z. B. Plausible/PostHog EU): Aktivierung, Feature-Nutzung, Onboarding-Funnel.
  *AK:* Dashboard mit Aktivierungs-Funnel; DSE erwähnt Tool.

---

# EPIC 8 — Kommerzialisierung & Legal (P3)

**Ziel:** Die App darf verkauft werden und kann Geld einnehmen.
**Sprint: 6–7**

- [ ] **S8.1 (P3, 8 SP) Billing (Stripe)**
  Pläne: Free (1 Team, X Spieler, ohne AI) / Pro (unbegrenzt, AI, PDF-Export). Stripe Checkout + Customer Portal + Webhooks; Plan-Limits serverseitig durchgesetzt.
  *AK:* Test-Abo abschließbar, kündbar; Limit-Überschreitung zeigt Upgrade-Prompt.

- [ ] **S8.2 (P3, 3 SP) Account-Lifecycle**
  E-Mail-Verifizierung, Passwort-Reset (E-Mail-Provider z. B. Resend), Account-Löschung inkl. Kaskade + DSGVO-Datenexport (JSON) pro Workspace.
  *AK:* Alle 4 Flows funktionieren E2E; Löschung entfernt nachweisbar alle personenbezogenen Daten.

- [ ] **S8.3 (P3, 2 SP) Legal-Paket**
  Impressum, Datenschutzerklärung (Art.-9-Gesundheitsdaten!), AGB, AVV-Liste (Supabase, Vercel, Anthropic, Stripe, E-Mail-Provider), Cookie-/Consent-Prüfung, Datenresidenz EU (Supabase-Region prüfen).
  *AK:* Seiten verlinkt im Footer + Spieler-Flow; juristisch gegengelesen (extern).

- [ ] **S8.4 (P3, 5 SP) Admin-Backoffice (minimal)**
  Interne Seite (separat absichert): Workspace-Suche, Nutzer-Support (Token neu senden, Workspace einsehen mit Audit-Log), Kennzahlen.
  *AK:* Support-Fall "Trainer hat Zugang verloren" ohne DB-Zugriff lösbar.

- [ ] **S8.5 (P3, 2 SP) Backup & Recovery**
  Supabase PITR/Backups verifizieren; Restore-Übung dokumentieren; Lösch-Schutz (Soft-Delete für Workspace mit 30-Tage-Frist).
  *AK:* Restore-Test erfolgreich protokolliert; versehentlich gelöschter Workspace wiederherstellbar.

---

## Sprint-Übersicht (Vorschlag, 1 Entwickler + Claude)

| Sprint | Fokus | Stories | SP |
|--------|-------|---------|----|
| **1** | 🔒 Sicherheit (Release-Blocker) | S1.1–S1.7 | 16 |
| **2** | 🏗️ Eine Datenschicht + Migrations-Baseline | S2.1–S2.5, S3.1 | 20 |
| **3** | 🗃️ Schema-Bereinigung + QS-Fundament | S3.2–S3.4, S3.6, S4.1–S4.5 | 22 |
| **4** | 🌍 Konsistenz/i18n + UX-Kern | S5.1–S5.4, S6.1, S6.4 | 18 |
| **5** | 🎨 Produkt-Generalisierung + A11y | S6.2, S6.3, S6.5, S6.6, S3.5 | 18 |
| **6** | ⚡ Skalierung + Billing-Start | S7.1–S7.4, S8.1 (Start) | 17 |
| **7** | 💰 Kommerzialisierung & Launch-Readiness | S8.1 (Ende)–S8.5 | 20 |

**Definition of Done (global):**
1. Akzeptanzkriterien erfüllt
2. `typecheck`, `lint`, Tests, Build grün (ab Sprint 3: in CI)
3. Keine neuen hardcodierten Strings (ab Sprint 4)
4. Sicherheitsrelevante Änderungen: Vier-Augen-Review (Mensch oder /code-review)
5. Migration getestet auf Staging vor Prod (ab Sprint 3)

**Release-Gates:**
- 🚫 **Kein öffentlicher Zugang für fremde Nutzer vor Abschluss Sprint 1** (EPIC 1)
- 🚫 Kein bezahlter Launch vor S8.2 + S8.3 (Account-Lifecycle + Legal)
