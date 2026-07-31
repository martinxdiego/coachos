import type { Metadata } from "next";
import {
  LegalCard,
  MissingLegalConfig,
  OperatorAddress
} from "../_legal";

export const metadata: Metadata = {
  title: "Datenschutz · CoachOS",
  robots: {
    index: process.env.LEGAL_PUBLISH === "true",
    follow: process.env.LEGAL_PUBLISH === "true"
  }
};

export default function PrivacyPage() {
  return (
    <LegalCard title="Datenschutzerklärung">
      <MissingLegalConfig />

      <section>
        <h2>1. Verantwortlicher</h2>
        <OperatorAddress />
      </section>

      <section>
        <h2>2. Zweck und Umfang</h2>
        <p>
          CoachOS unterstützt Fußballteams bei Organisation, Trainingsplanung,
          Spieltagen, Kommunikation und der freiwilligen Erfassung von
          Wohlbefindensangaben. Verarbeitet werden Konto- und Teamdaten,
          Spieler- und Elternkontaktdaten, Termin- und Leistungsdaten,
          Nachrichten, technische Sicherheitsdaten sowie – nur nach
          ausdrücklicher Einwilligung – gesundheitsbezogene Angaben.
        </p>
      </section>

      <section>
        <h2>3. Rechtsgrundlagen und Minderjährige</h2>
        <p>
          Die Verarbeitung erfolgt je nach Nutzung zur Vertragserfüllung, auf
          Grundlage berechtigter Interessen am sicheren Teammanagement oder
          aufgrund einer Einwilligung. Gesundheitsdaten sind besonders
          geschützt und werden nur mit ausdrücklicher Einwilligung verarbeitet.
          Bei Minderjährigen muss die nach lokalem Recht erforderliche
          Zustimmung der erziehungsberechtigten Person vorliegen. Eine
          Einwilligung kann mit Wirkung für die Zukunft widerrufen werden.
        </p>
      </section>

      <section>
        <h2>4. Empfänger und Auftragsverarbeiter</h2>
        <p>
          Zugriff erhalten nur berechtigte Mitglieder des jeweiligen
          Trainerteams sowie der Spieler beziehungsweise seine Eltern über
          widerrufbare Gerätezugänge. Für den technischen Betrieb können
          Hosting-, Datenbank-, Speicher-, E-Mail-, Push-, Monitoring- und
          KI-Dienstleister eingesetzt werden. Die konkrete, produktiv
          eingesetzte Unterauftragsverarbeiterliste muss vor dem Start
          dokumentiert und aktuell gehalten werden.
        </p>
      </section>

      <section>
        <h2>5. KI-Funktionen</h2>
        <p>
          KI-Entwürfe erhalten nur kontrollierte Kategorien und aggregierte
          Teamwerte. Namen, Kontaktangaben, Freitexte und medizinische Rohdaten
          werden nicht an den KI-Anbieter übertragen. KI-Ergebnisse sind
          Vorschläge und ersetzen keine sportmedizinische oder fachliche
          Entscheidung.
        </p>
      </section>

      <section>
        <h2>6. Speicherdauer, Export und Löschung</h2>
        <p>
          Der Workspace-Owner legt Aufbewahrungsfristen für allgemeine und
          gesundheitsbezogene Daten fest. Abgelaufene Daten werden automatisiert
          bereinigt. Owner können ein Datenarchiv exportieren und den Workspace
          nach erneuter Passwortbestätigung dauerhaft löschen. Gesetzliche
          Aufbewahrungspflichten bleiben vorbehalten.
        </p>
      </section>

      <section>
        <h2>7. Sicherheit und Gerätezugänge</h2>
        <p>
          CoachOS nutzt verschlüsselte Übertragung, private Medienspeicher,
          rollenbasierte Zugriffe, Rate-Limits, Audit-Ereignisse und
          widerrufbare, zeitlich begrenzte Geräte-Sessions. Persönliche Links,
          Passwörter und Gesundheitsdaten dürfen nicht unverschlüsselt
          weitergegeben werden.
        </p>
      </section>

      <section>
        <h2>8. Rechte betroffener Personen</h2>
        <p>
          Betroffene können – soweit anwendbar – Auskunft, Berichtigung,
          Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch
          verlangen sowie eine Einwilligung widerrufen. Außerdem besteht ein
          Beschwerderecht bei der zuständigen Datenschutzaufsicht.
        </p>
      </section>

      <section>
        <h2>9. Cookies und lokale App-Daten</h2>
        <p>
          Es werden technisch notwendige Cookies für Anmeldung, aktive
          Workspace-Auswahl, Sprache und Spieler-Gerätezugang verwendet.
          Personalisierte Inhalte werden nicht im Offline-Cache gespeichert.
          Nicht notwendiges Tracking darf erst nach gesonderter Prüfung und,
          falls erforderlich, Einwilligung aktiviert werden.
        </p>
      </section>
    </LegalCard>
  );
}
