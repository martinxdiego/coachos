# Accessibility (S6.5)

CoachOS erhebt Daten von Minderjährigen und wird teils von Kindern/Eltern
genutzt (Spieler-Check-in). Barrierefreiheit ist damit nicht nur gute Praxis,
sondern fällt unter den European Accessibility Act (EAA, Pflicht seit 06/2025).
Ziel dieser Basis: **keine `critical`/`serious` axe-core-Verstösse** in den
Kern-Flows Login, Spieler-Check-in und Dashboard.

## Was geprüft/umgesetzt wurde

- **Tastatur-Bedienung (WCAG 2.1.1):** Die Check-in-Skala (`ScoreScale`) ist ein
  echtes `radiogroup` mit Roving-Tabindex und reagiert jetzt auf
  Pfeiltasten / Home / End — Werte sind ohne Maus änderbar.
- **Disclosure-Semantik:** Der Aufklapp-Button der Check-in-Karte hat
  `aria-expanded` + `aria-controls`, das Panel die passende `id`.
- **Bypass Blocks (WCAG 2.4.1):** Skip-Link „Zum Hauptinhalt springen" in der
  App-Shell, Ziel `#main-content` (fokussierbar via `tabIndex={-1}`).
- **Namen für Icon-Steuerelemente:** Logout-Button (`aria-label`),
  Sprachumschalter (`aria-label` + dekoratives Icon `aria-hidden`).
- **Formular-Labels:** Login- und Check-in-Felder sind über `htmlFor`/`id`
  bzw. `aria-label` verknüpft; dekorative Icons durchgängig `aria-hidden`.
- **Touch-Targets ≥ 44 px:** Check-in-Skala und Submit-Buttons nutzen `h-11`/
  `h-12`. Die dichte Coach-Variante (`size="sm"`, 36 px) bleibt > 24 px (WCAG
  2.5.8 AA).
- **Reduced Motion:** Die Login-Intro-Animation respektiert
  `prefers-reduced-motion`.
- **Sprache:** `<html lang>` wird aus dem aktiven Locale gesetzt.

## Automatisierte Prüfung

`tests/unit/a11y.test.tsx` rendert die interaktiven Check-in-Komponenten
(`ScoreScale`, `PublicCheckinCard`) zu Markup und lässt **axe-core** in jsdom
darüber laufen; der Test schlägt bei `critical`/`serious`-Verstössen fehl. Läuft
in CI mit `npm test`, kein Browser nötig.

```bash
npm test -- tests/unit/a11y.test.tsx
```

**Grenze:** Farbkontrast (WCAG 1.4.3) braucht Layout, das jsdom nicht berechnet
— axe meldet das als `incomplete`, nicht als `violation`. Kontraste sowie die
vollständigen Seiten **Login** und **Dashboard** (Server-Komponenten mit
Auth/DB, im Unit-Test nicht renderbar) werden gegen die laufende App geprüft.

## Offen / nächste Schritte

- Playwright-Spec mit `@axe-core/playwright` gegen die laufende App für Login
  (öffentlich), Check-in und Dashboard (Auth-Fixture nötig) — schliesst die
  Kontrast- und Voll-Seiten-Lücke.
- Manueller Screenreader-Durchlauf des Check-in-Flows (VoiceOver/NVDA).
- Die wenigen hartkodierten Strings in der App-Shell (Skip-Link, „Abmelden",
  „Workspace wählen") gehören in den i18n-Tail (S5.2).
