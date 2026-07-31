// S6.6: Eltern-/Erziehungsberechtigten-Einwilligung im Spieler-Beitritts-Flow.
//
// Die Version wird zusammen mit dem Zeitpunkt bei jeder Selbstregistrierung
// gespeichert (Player.consentVersion / consentAcceptedAt). Wird der
// Einwilligungstext oder die Datenschutzerklärung inhaltlich geändert, hier
// die Version hochzählen — so bleibt nachvollziehbar, welcher Stand akzeptiert
// wurde.
export const CURRENT_CONSENT_VERSION = "2026-06-15";

// Die interne Datenschutzerklärung ist immer erreichbar. Deployments können
// sie bei Bedarf mit einer vereinseigenen externen URL überschreiben.
export const PRIVACY_URL =
  process.env.NEXT_PUBLIC_PRIVACY_URL?.trim() || "/legal/privacy";
