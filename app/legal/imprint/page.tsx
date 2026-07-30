import type { Metadata } from "next";
import {
  LegalCard,
  MissingLegalConfig,
  OperatorAddress
} from "../_legal";

export const metadata: Metadata = {
  title: "Impressum · CoachOS",
  robots: {
    index: process.env.LEGAL_PUBLISH === "true",
    follow: process.env.LEGAL_PUBLISH === "true"
  }
};

export default function ImprintPage() {
  return (
    <LegalCard title="Impressum">
      <MissingLegalConfig />
      <section>
        <h2>Anbieter und verantwortlich für den Inhalt</h2>
        <OperatorAddress />
      </section>
      <section>
        <h2>Weitere Pflichtangaben</h2>
        <p>
          Rechtsform, vertretungsberechtigte Person, Registereintrag,
          Registergericht, Registernummer und Umsatzsteuer-ID sind – sofern
          zutreffend – vor Veröffentlichung entsprechend dem Sitz des
          Betreibers zu ergänzen.
        </p>
      </section>
      <section>
        <h2>Haftungshinweis</h2>
        <p>
          Inhalte werden sorgfältig gepflegt. CoachOS stellt keine medizinische
          Diagnose und ersetzt keine Untersuchung durch qualifiziertes
          Fachpersonal. Für externe Links sind deren jeweilige Betreiber
          verantwortlich.
        </p>
      </section>
    </LegalCard>
  );
}
