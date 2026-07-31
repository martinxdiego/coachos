# CoachOS – Markt- und Release-Readiness

Stand: 30. Juli 2026

## In dieser Ausbaustufe umgesetzt

- Authentifizierungsgrenzen mit expliziten öffentlichen Routen; interne
  Bereiche und PDF-Endpunkte sind nicht mehr versehentlich öffentlich.
- Private Supabase-Buckets, mandantengebundene signierte Medien-URLs,
  geprüfte und metadatenbereinigte Uploads sowie keine extern erzeugten
  QR-Codes.
- Autorisierte Push-An- und -Abmeldung, geschützter täglicher Cron-Job und
  serverseitige Ableitung der Spieleridentität.
- CSP und weitere Security-Header, gemeinsame Redis-Drosselung mit
  ausdrücklich instanzgebundenem Notfall-Fallback, abgesicherter
  Health-Endpunkt und tokenfreie Fehlerlogs.
- PWA-Grundlage mit Installation, Safe Areas, Offline-Hinweis und
  Offline-Fallback. Personalisierte Seiten werden nicht im Service Worker
  zwischengespeichert.
- Mobile Navigation, 44-Pixel-Touch-Ziele, Fokusfallen, Escape-Verhalten und
  iOS-taugliche Formulare ohne Auto-Zoom.
- KI-Payloads enthalten nur kontrollierte Kategorien und Team-Aggregate.
  Namen, IDs, Gegner, Freitext und medizinische Rohdaten verlassen die App
  nicht.
- Gesundheitsanzeige als transparenter Belastungshinweis statt
  Verletzungsprognose oder Diagnose.
- CI-Gates für Typecheck, Lint, Unit-/Accessibility-Tests, Build sowie hohe
  und kritische Produktionsabhängigkeiten.
- Owner-geschützter JSON-Datenexport ohne Passwörter, Zugangstokens,
  Invite-Codes oder Push-Geheimnisse sowie passwortbestätigte,
  transaktionale Workspace-Löschung. Private Medien werden dabei dauerhaft
  über die Storage-Löschwarteschlange entfernt.
- Spieler- und Elternlinks werden beim ersten Aufruf gegen 30 Tage gültige,
  HttpOnly-gesicherte Geräte-Sessions ausgetauscht. Geräte können einzeln oder
  gemeinsam widerrufen werden; rotierte Links beenden Sessions und
  Push-Abonnements.
- Passwort-Recovery per Einmal-Link, optionale E-Mail-Verifizierung,
  kontenweite Session-Invalidierung nach Passwortwechsel und endgültige
  Kontolöschung sind umgesetzt.
- Konfigurierbare Aufbewahrungsfristen, tägliche Datenbereinigung,
  sicherheitsrelevante Audit-Ereignisse und eine In-App-Supportseite sind
  vorhanden.
- Spieler und Eltern können für Training und Spiel mit Dabei, Vielleicht oder
  Abwesend antworten. Trainer sehen daraus einen mobilen Live-Kader.
- Pricing, Stripe Checkout, Kundenportal, signaturgeprüfte Webhooks und
  serverseitige Free-/Pro-Limits sind implementiert und über
  `BILLING_ENFORCE` kontrolliert aktivierbar.
- Impressum, Datenschutz und Nutzungsbedingungen sind als integrierte,
  konfigurierbare Vorlagen vorhanden. Sie bleiben bis zur externen Prüfung
  mit `LEGAL_PUBLISH=false` von Suchmaschinen ausgeschlossen.
- Der Produktionsabhängigkeits-Scan meldet zum genannten Stand 0 bekannte
  Schwachstellen.

## Vor einem öffentlichen Pilot zwingend extern erledigen

1. Staging und Produktion trennen. Alle Werte aus `.env.example` setzen;
   `AUTH_SECRET`, `CRON_SECRET`, Datenbank-, Supabase-Service-, Redis- und
   VAPID-Schlüssel sowie – falls Invite-only gewünscht ist –
   `COACH_SIGNUP_CODE` vor dem Start neu erzeugen;
   `AUTH_TRUST_HOST=true` nur hinter dem vertrauenswürdigen Deployment-Proxy
   setzen.
2. Prisma-Migrationen zuerst in Staging und danach in Produktion ausführen:
   `npm run db:migrate:deploy` und `npm run db:migrate:status`.
   Danach mit dem Supabase-Anon-Key verifizieren, dass Prisma-Tabellen über
   die Data API weder lesbar noch beschreibbar sind; die Migration
   `20260724150000_lock_down_public_schema` aktiviert dafür RLS und entzieht
   den Client-Rollen alle Tabellenrechte.
3. In Supabase
   `supabase/migrations/20260724090000_private_media_buckets.sql` ausführen
   und bestätigen, dass beide Buckets privat sind. Bereits veröffentlichte
   Altdateien prüfen und gegebenenfalls verschieben beziehungsweise ihre
   alten öffentlichen Links invalidieren.
4. Die integrierten Legal-Vorlagen vervollständigen und juristisch prüfen:
   Verantwortlicher, Zweck, Aufbewahrung/Löschung, Auskunft/Export,
   Auftragsverarbeiter, Push und KI-Anbieter sowie bei Minderjährigen die
   nötige Zustimmung der Erziehungsberechtigten.
5. Datenbank- und Storage-Backups aktivieren, Wiederherstellung in Staging
   testen und RPO/RTO dokumentieren.
6. `/api/health`, Fehlerquote, Retention-, Push- und Storage-Cron überwachen.
   Die initialen `/p/<accessToken>`-Aufrufe weiterhin vor Analytics und Logs
   zu `/p/[redacted]` normalisieren; die normale Portalnutzung läuft tokenfrei
   unter `/player`.
7. Der automatisierte Kernablauf ist auf Desktop Chrome, Android Chrome,
   iPhone WebKit und iPad WebKit grün. Zusätzlich einen Pilot mit einem Team
   und echten Geräten durchführen:
   iPhone/Safari, Android/Chrome, iPad sowie Desktop Chrome/Firefox/Safari.
   Dabei Einladen, Check-in, Push, Upload, Training, Spieltag, Export und
   Spieler-/Datenlöschung als vollständige Abläufe testen.
8. Vor dem Pilot konkrete Aufbewahrungsfristen und Verantwortlichkeiten
   dokumentieren. Für den Pilot messbare Erfolgskriterien festlegen, etwa
   Aktivierung bis zum ersten Event, Rücklaufquote bei Zu-/Absagen,
   fehlerfreie Kernabläufe und Supportaufwand.
9. Für E-Mail `RESEND_API_KEY`, Absender-Domain und Supportadresse setzen und
   Passwort-Reset sowie Verifizierung gegen echte Postfächer testen.
10. Für einen bezahlten Start Stripe zunächst im Testmodus einrichten:
    Produkt/Preis, Checkout, Kundenportal und Webhook-Endpunkt testen. Erst
    danach `BILLING_ENFORCE=true` setzen und auf Live-Keys wechseln.

## Bewusste Grenzen dieser Stufe

- Die PWA zeigt Offline-Status und eine Offline-Seite, speichert aber noch
  keine Änderungen in einer synchronisierbaren Outbox. Formulare sind offline
  deshalb absichtlich gesperrt beziehungsweise nicht speicherbar.
- Ein Spielerlink ist weiterhin ein initiales Bootstrap-Geheimnis und muss
  vertraulich verteilt werden. Danach arbeitet das Portal mit widerrufbaren
  Geräte-Sessions. Ein echtes Passwort-/Passkey-Konto pro Spieler oder Elternteil
  ist für Vereinsverbünde weiterhin eine mögliche spätere Ausbaustufe.
- E-Mail, Stripe, Push, Monitoring, Backups und rechtliche Freigabe benötigen
  externe Konten beziehungsweise Entscheidungen und können nicht allein durch
  Quellcode produktiv aktiviert werden.

## Nächste Produktetappe

1. Externe Pilot-Freigaben abschließen: Legal Review, Backups/Restore,
   Monitoring, Support-SLA und echte Mail-/Push-Geräte.
2. Ereigniskommunikation um eventbezogene Ankündigungen, Antwortfrist,
   automatische Erinnerungen und Kalender-Abonnements ergänzen.
3. Den vorhandenen Spieltagsumfang – Aufgebot, Treffpunkt, Formation,
   Live-Ereignisse und Nachbereitung – zu einem einzigen geführten
   Matchday-Screen zusammenführen.
4. Billing im Stripe-Testmodus abnehmen, Trial-/Preisentscheidung treffen und
   erst danach die serverseitigen Planlimits aktivieren.
5. Minimalen Admin-Support mit Rollenmodell, Workspace-Suche und vollständig
   auditierten Supportaktionen erstellen.
