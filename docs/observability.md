# Observability

## Bereits im Code

- `lib/logger.ts` schreibt strukturierte JSON-Logs. Häufige Zugangstokens,
  E-Mail-Adressen und IDs werden in Logmeldungen automatisch maskiert.
- `instrumentation.ts` erfasst unbehandelte Request-Fehler mit HTTP-Methode
  und einer bereinigten, tokenfreien Route.
- `GET /api/health` prüft die Datenbankverbindung und liefert bei Fehlern nur
  eine generische Antwort. Der Endpunkt setzt `Cache-Control: no-store`.
- Redis-Ausfälle werden einmalig protokolliert; die Anwendung fällt lokal auf
  ein instanzgebundenes Rate-Limit zurück.

Keine Namen, E-Mail-Adressen, Zugangslinks, Gesundheitsangaben oder freie
Spielertexte als Logfelder verwenden. Auch bei einem späteren Monitoring-SDK
müssen Request-Header, Cookies, Query-Parameter und Request-Bodies deaktiviert
oder entfernt bleiben.

## Produktionsbetrieb

1. Einen externen HTTPS-Monitor auf `/api/health` setzen und bei zwei
   aufeinanderfolgenden Fehlern alarmieren.
2. Runtime-Logs an ein System mit Zugriffskontrolle, kurzer Aufbewahrung und
   Alarmen für Fehlerquote, Latenz und fehlgeschlagene Cron-Läufe senden.
3. Releases mit `VERCEL_GIT_COMMIT_SHA` korrelieren.
4. Optional Sentry über `registerErrorSink` anbinden. Dabei
   `sendDefaultPii: false` setzen und in `beforeSend` URL, Query-Parameter,
   Cookies, Header und Request-Body entfernen.

Der initiale Spielerlink unter `/p/<accessToken>` wird beim Aufruf gegen eine
widerrufbare HttpOnly-Geräte-Session ausgetauscht und danach auf `/player`
umgeleitet. Trotzdem darf kein Analytics-Tool den einmaligen Bootstrap-Aufruf
ungefiltert erfassen; `/p/*` muss vor jeder Übertragung weiterhin zu
`/p/[redacted]` normalisiert werden.
