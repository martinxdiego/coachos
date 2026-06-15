-- S6.6: Eltern-Einwilligung im Spieler-Flow.
-- Hält fest, ob und wann eine Einwilligung erteilt wurde und welche Version
-- des Einwilligungstexts akzeptiert wurde. Additiv und nullable — bestehende
-- Spieler bleiben unberührt.

ALTER TABLE "Player" ADD COLUMN "consentAcceptedAt" TIMESTAMP(3);
ALTER TABLE "Player" ADD COLUMN "consentVersion" TEXT;
