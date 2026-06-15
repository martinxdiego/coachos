-- S6.2: Konfigurierbare Vereins-Begriffe pro Workspace.
-- Neue Spalten sind nullable; NULL bedeutet "neutralen Default verwenden"
-- (Teampunkte / Auszeichnungen / Vereinslinks). Bestehende Workspaces behalten
-- ihre bisherigen Begriffe, indem die Spalten einmalig mit den Alt-Werten
-- befüllt werden — neue Workspaces starten neutral.

ALTER TABLE "Workspace" ADD COLUMN "pointsLabel" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "awardsLabel" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "linksLabel" TEXT;

UPDATE "Workspace"
SET "pointsLabel" = 'Winnerpunkte',
    "awardsLabel" = 'Hut-System',
    "linksLabel"  = 'Clubcorner / Quali';
