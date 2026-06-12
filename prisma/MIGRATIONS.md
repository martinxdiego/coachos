# Datenbank-Migrationen (Prisma)

Ab sofort ist das Prisma-Schema die Single Source of Truth und Änderungen
laufen über **Migrationen** — kein `prisma db push` mehr gegen geteilte
Umgebungen (Staging/Prod).

## Einmalige Baseline (S3.1)

Die bestehende Datenbank wurde bisher per `db push` aufgebaut, es gab keine
Migrationshistorie. `prisma/migrations/0_init/migration.sql` ist die
Baseline, die exakt dem aktuellen Schema entspricht.

**Auf jeder bereits existierenden Umgebung (Prod, Staging) genau einmal
ausführen**, damit Prisma die Baseline als „bereits angewendet" verbucht,
ohne die vorhandenen Tabellen neu anzulegen:

```bash
# DATABASE_URL der jeweiligen Umgebung setzen, dann:
npm run db:baseline      # = prisma migrate resolve --applied 0_init
npm run db:migrate:status # sollte "Database schema is up to date" zeigen
```

> ⚠️ Erst nach erfolgreichem `db:baseline` auf einer Umgebung darf dort
> `prisma migrate deploy` laufen. Vorher würde es versuchen, `0_init`
> anzuwenden und an bereits existierenden Tabellen scheitern.

## Neue Änderungen entwickeln

```bash
# Schema in prisma/schema.prisma anpassen, dann lokal:
npm run db:migrate -- --name beschreibender_name
```

Das erzeugt einen neuen Ordner unter `prisma/migrations/` und wendet ihn
lokal an. Den Ordner committen.

## Deployment

Sobald die Baseline auf allen Umgebungen verbucht ist, neue Migrationen im
Deploy automatisch anwenden:

```bash
npm run db:migrate:deploy
```

Empfehlung: nach der Baseline den `build`-Schritt auf
`prisma migrate deploy && prisma generate && next build` umstellen (separater
Commit, erst wenn Staging + Prod gebaselined sind).
