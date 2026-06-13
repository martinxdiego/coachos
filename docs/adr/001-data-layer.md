# ADR 001 — Eine Datenschicht: Server Components + Server Actions (Prisma)

- **Status:** akzeptiert (2026-06-13)
- **Kontext:** Sprint 2 / EPIC 2 — Architektur-Konsolidierung

## Kontext

Die Codebasis trug drei parallele Datenzugriffswege mit sich:

1. **Server Actions + Prisma** — der tatsächlich genutzte Weg für alle
   Mutationen und (über Server Components) alle Reads.
2. **tRPC** (`lib/trpc/*`, `/api/trpc`, Provider im Root-Layout) — vollständig
   verdrahtet, aber **von keiner Client-Komponente aufgerufen**
   (`trpc.*.useQuery/useMutation` kommt nirgends vor).
3. **Supabase-Direktzugriff** — bereits in S2.1 entfernt (nur noch Storage).

tRPC war damit toter Code, der zugleich eine echte Angriffsfläche bot: die
Router waren über `/api/trpc` öffentlich erreichbar und mussten in S1.1 gegen
Mandanten-Übergriffe (IDOR) abgesichert werden, obwohl sie kein Feature
bedienen.

## Entscheidung

**Server Components (Reads via Prisma) + Server Actions (Mutations via Prisma)
sind die einzige Datenschicht.** tRPC und seine Abhängigkeiten werden entfernt:

- `lib/trpc/**`, `app/api/trpc/**`
- `TRPCReactProvider` aus `app/layout.tsx`
- Dependencies `@trpc/client`, `@trpc/next`, `@trpc/react-query`,
  `@trpc/server`, `@tanstack/react-query`

## Konsequenzen

- **Weniger Angriffsfläche:** der öffentliche `/api/trpc`-Endpunkt entfällt
  komplett (die in S1.1 ergänzte `workspaceProcedure`-Absicherung war für die
  Lebenszeit des Endpunkts korrekt, wird mit der Entfernung aber obsolet).
- **Kein doppelter Pfad mehr** für dieselbe Operation.
- **Falls künftig reaktive Client-seitige Reads gebraucht werden:** als Server
  Actions + `useActionState`/`useOptimistic` umsetzen, oder tRPC gezielt und
  abgesichert wieder einführen — dann mit klarer Begründung in einer neuen ADR.

## Autorisierung (gilt weiterhin)

Jede Server Action lädt den aktiven Workspace über `requireActiveTeam` und
scoped Schreib-/Lesezugriffe per `workspaceId`; destruktive Aktionen sind auf
`OWNER` beschränkt (siehe `docs/permissions.md`).
