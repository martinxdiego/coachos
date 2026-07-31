import type { Metadata } from "next";
import { LegalCard, MissingLegalConfig } from "../_legal";

export const metadata: Metadata = {
  title: "Nutzungsbedingungen · CoachOS",
  robots: {
    index: process.env.LEGAL_PUBLISH === "true",
    follow: process.env.LEGAL_PUBLISH === "true"
  }
};

export default function TermsPage() {
  return (
    <LegalCard title="Nutzungsbedingungen">
      <MissingLegalConfig />
      <section>
        <h2>1. Geltungsbereich</h2>
        <p>
          Diese Bedingungen regeln die Nutzung von CoachOS durch Trainer,
          Vereine, Spieler und Eltern. Individuelle Vertrags- und
          Preisbedingungen gehen vor.
        </p>
      </section>
      <section>
        <h2>2. Konten und Verantwortung</h2>
        <p>
          Zugangsdaten sind geheim zu halten. Workspace-Owner verwalten Rollen,
          Einwilligungen, Aufbewahrungsfristen und die Rechtmäßigkeit der
          eingestellten Daten. Persönliche Spielerlinks dürfen nur an die
          berechtigte Person beziehungsweise deren Eltern weitergegeben werden.
        </p>
      </section>
      <section>
        <h2>3. Zulässige Nutzung</h2>
        <p>
          Unzulässig sind rechtswidrige Inhalte, missbräuchliche Überwachung,
          automatisierte Angriffe, Umgehung von Zugriffsschutz sowie die Nutzung
          von Gesundheitshinweisen als Diagnose oder alleinige Grundlage für
          medizinische Entscheidungen.
        </p>
      </section>
      <section>
        <h2>4. Verfügbarkeit und Änderungen</h2>
        <p>
          Wartung, Sicherheitsupdates und technisch notwendige Änderungen
          können die Verfügbarkeit zeitweise einschränken. Wesentliche
          Vertragsänderungen werden rechtzeitig mitgeteilt.
        </p>
      </section>
      <section>
        <h2>5. Haftung und Datenexport</h2>
        <p>
          Trainer bleiben für sportliche, pädagogische und medizinische
          Entscheidungen verantwortlich. Vor Vertragsende soll der verfügbare
          Workspace-Export genutzt werden. Zwingende gesetzliche Haftung bleibt
          unberührt.
        </p>
      </section>
      <section>
        <h2>6. Beendigung</h2>
        <p>
          Workspaces können durch berechtigte Owner nach erneuter
          Passwortbestätigung gelöscht werden. Fristen, Folgen einer Kündigung
          und gegebenenfalls Erstattungen sind vor einem bezahlten Start in den
          konkreten Tarifbedingungen zu ergänzen.
        </p>
      </section>
    </LegalCard>
  );
}
