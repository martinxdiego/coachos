// S6.6: Eltern-/Erziehungsberechtigten-Einwilligung im Spieler-Beitritts-Flow.
//
// Die Version wird zusammen mit dem Zeitpunkt bei jeder Selbstregistrierung
// gespeichert (Player.consentVersion / consentAcceptedAt). Wird der
// Einwilligungstext oder die Datenschutzerklärung inhaltlich geändert, hier
// die Version hochzählen — so bleibt nachvollziehbar, welcher Stand akzeptiert
// wurde.
export const CURRENT_CONSENT_VERSION = "2026-06-15";

// Optionaler Link zur Datenschutzerklärung. Ist die Env-Var nicht gesetzt,
// wird im Formular reiner Hinweistext statt eines (toten) Links gezeigt.
export const PRIVACY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL ?? null;
