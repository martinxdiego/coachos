# Rollen & Berechtigungen (S1.7)

Drei Rollen pro Workspace. **OWNER** ist der einzige, der administrative
oder destruktive Aktionen ausführen darf. **COACH** und **ASSISTANT** haben
identische, volle Rechte für die tägliche Trainerarbeit — der Unterschied ist
nur eine Kennzeichnung (z. B. Cheftrainer vs. Co-Trainer), keine
Rechtetrennung.

| Aktion                                            | OWNER | COACH | ASSISTANT |
|---------------------------------------------------|:-----:|:-----:|:---------:|
| Workspace-Einstellungen ändern (Name/Saison)      |  ✅   |  ❌   |    ❌     |
| Workspace löschen                                 |  ✅   |  ❌   |    ❌     |
| Staff einladen / Invite-Codes verwalten           |  ✅   |  ❌   |    ❌     |
| Spieler/Trainings/Spiele/Material anlegen & bearbeiten | ✅ | ✅ |    ✅     |
| Bewertungen, Gesundheit, Punkte, Awards           |  ✅   |  ✅   |    ✅     |
| Spieler-Beitrittslink erzeugen/erneuern           |  ✅   |  ✅   |    ✅     |
| Spieler-Modus-Vorschau (Staff-Sicht)              |  ✅   |  ✅   |    ✅     |

## Durchsetzung im Code

- `canManageWorkspace(role)` in `app/actions.ts` → nur `owner`. Genutzt von
  `updateTeam` und `createTeamInvite`.
- tRPC `workspace.update`/`workspace.delete` → `role: "OWNER"`.
- `app/(app)/workspaces/page.tsx` zeigt Verwaltungs-UI nur bei `canManage`.
- Mitgliedschaft jeder workspace-/spielerbezogenen Aktion wird über die
  tRPC-Middleware (`workspaceProcedure`/`playerProcedure`, S1.1) bzw. in den
  Server Actions über `requireActiveTeam` + `workspaceId`-Scope erzwungen.

## Datenmigration

`prisma/migrations/20260612120000_reduce_roles` bildet Altwerte ab:
`OWNER/ADMIN/HEAD_COACH → OWNER`, `TRAINER/COACH → COACH`, Rest `→ ASSISTANT`.

## Offen

Automatisierte Tests für verbotene Aktionen (mind. 3) folgen mit **S4.2**
(Test-Fundament).
