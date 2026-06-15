// S6.5: Accessibility-Basis (EAA-Pflicht seit 06/2025).
//
// Rendert die interaktiven Kern-Komponenten der für Kinder/Eltern sichtbaren
// Flows (Spieler-Check-in) zu statischem Markup und lässt axe-core in jsdom
// darüber laufen. Schlägt fehl, sobald ein Verstoss der Schwere "critical" oder
// "serious" auftritt — das ist das Akzeptanzkriterium der Story. (Farbkontrast
// braucht Layout-Informationen, die jsdom nicht hat, und landet daher in axe
// als "incomplete", nicht "violation" — Kontraste/Login/Dashboard werden gegen
// die laufende App geprüft, siehe docs/accessibility.md.)
import { beforeAll, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import deMessages from "@/messages/de.json";
import { ScoreScale } from "@/components/score-scale";
import { PublicCheckinCard } from "@/components/public-checkin-card";

// axe-core und jsdom werden in beforeAll geladen, nachdem die globalen
// Browser-Objekte gesetzt sind, damit axe sich an das jsdom-window bindet.
let axe: typeof import("axe-core");
let doc: Document;

beforeAll(async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  g.Node = dom.window.Node;
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  doc = dom.window.document;
  const mod = (await import("axe-core")) as unknown as {
    default?: typeof import("axe-core");
  };
  axe = mod.default ?? (mod as unknown as typeof import("axe-core"));
}, 60000);

function withIntl(child: ReactElement) {
  return (
    <NextIntlClientProvider
      locale="de"
      messages={deMessages}
      timeZone="Europe/Zurich"
    >
      {child}
    </NextIntlClientProvider>
  );
}

async function seriousViolations(element: ReactElement) {
  doc.body.innerHTML = renderToStaticMarkup(element);
  const results = await axe.run(doc.body, { resultTypes: ["violations"] });
  return results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );
}

function describeViolations(violations: { id: string; help: string }[]) {
  return violations.map((v) => `${v.id}: ${v.help}`).join("\n");
}

describe("a11y: ScoreScale (Check-in-Skala)", () => {
  it("hat keine kritischen/schweren axe-Verstösse", async () => {
    const violations = await seriousViolations(
      <ScoreScale direction="low-good" label="Müdigkeit" name="fatigue" />
    );
    expect(violations, describeViolations(violations)).toHaveLength(0);
  }, 30000);
});

describe("a11y: PublicCheckinCard (Spieler-Check-in)", () => {
  it("hat keine kritischen/schweren axe-Verstösse", async () => {
    const violations = await seriousViolations(
      withIntl(
        <PublicCheckinCard
          accessToken="test-token"
          alreadyDone={false}
          todayCheckin={null}
        />
      )
    );
    expect(violations, describeViolations(violations)).toHaveLength(0);
  }, 30000);
});
