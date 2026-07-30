import {
  Building2,
  Download,
  KeyRound,
  Plus,
  ShieldAlert,
  Trash2,
  UsersRound
} from "lucide-react";
import {
  createTeam,
  createTeamInvite,
  deleteWorkspace,
  joinTeamWithInvite,
  setActiveTeam,
  updateTeam,
  updateRetentionPolicy
} from "@/app/actions";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOptionalActiveTeam } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface WorkspacesPageProps {
  searchParams?: Promise<{
    message?: string;
  }>;
}

export default async function WorkspacesPage({
  searchParams
}: WorkspacesPageProps) {
  const { activeTeam, teamOptions } = await getOptionalActiveTeam();
  const t = await getTranslations("pages");
  const resolvedSearchParams = await searchParams;
  const message = resolvedSearchParams?.message;
  const team = activeTeam?.team;
  const membership = activeTeam?.membership;
  const canManage = membership?.role === "OWNER";

  const [memberCount, dbInvites, auditLogs] = team
    ? await Promise.all([
        db.workspaceMember.count({
          where: { workspaceId: team.id }
        }),
        canManage
          ? db.teamInvite.findMany({
              where: { workspaceId: team.id, role: { not: "PLAYER" } },
              select: {
                id: true,
                code: true,
                role: true,
                expiresAt: true,
                usedAt: true,
                createdAt: true
              },
              orderBy: { createdAt: "desc" },
              take: 6
            })
          : Promise.resolve([])
        ,
        canManage
          ? db.auditLog.findMany({
              where: { workspaceId: team.id },
              select: { id: true, event: true, createdAt: true },
              orderBy: { createdAt: "desc" },
              take: 8
            })
          : Promise.resolve([])
      ])
    : [0, [], []];

  const invites = dbInvites.map((invite) => ({
    id: invite.id,
    code: invite.code,
    role: invite.role,
    expires_at: invite.expiresAt.toISOString(),
    used_at: invite.usedAt ? invite.usedAt.toISOString() : null,
    created_at: invite.createdAt.toISOString()
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("workspaces_desc")}
        title={t("workspaces_title")}
      />

      {message ? (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Workspace auswählen</CardTitle>
              <CardDescription>
                Alle Spieler, Trainings, Spiele, Materialien und Taktiken sind
                an den aktiven Workspace gebunden.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamOptions.length > 0 ? (
                teamOptions.map(({ team: option, membership: optionMember }) => (
                  <form
                    action={setActiveTeam}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-background/70 p-4 transition hover:border-primary/40 hover:bg-white sm:flex-row sm:items-center sm:justify-between"
                    key={option.id}
                  >
                    <input name="team_id" type="hidden" value={option.id} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">{option.name}</h3>
                        {activeTeam?.team.id === option.id ? (
                          <Badge variant="success">Aktiv</Badge>
                        ) : null}
                        <Badge variant="secondary">{optionMember.role}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {option.season ?? "Saison offen"} ·{" "}
                        {option.ageGroup ?? "Altersklasse offen"}
                      </p>
                    </div>
                    <Button type="submit" variant="outline">
                      Öffnen
                    </Button>
                  </form>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Noch kein Workspace. Erstelle einen eigenen oder tritt per
                  Invite-Code einem Trainerteam bei.
                </div>
              )}
            </CardContent>
          </Card>

          {team ? (
            <Card>
              <CardHeader>
                <CardTitle>Aktiver Workspace</CardTitle>
                <CardDescription>
                  Basisdaten für Dashboard, Planung und Ausdrucke.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {canManage ? (
                  <form action={updateTeam} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input defaultValue={team.name} id="name" name="name" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="season">Saison</Label>
                        <Input
                          defaultValue={team.season ?? ""}
                          id="season"
                          name="season"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="age_group">Altersklasse</Label>
                        <Input
                          defaultValue={team.ageGroup ?? ""}
                          id="age_group"
                          name="age_group"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/30 p-4">
                      <div>
                        <p className="text-sm font-medium tracking-tight">
                          Eigene Begriffe
                        </p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          Leer lassen für die neutralen Standardbegriffe. Wirkt
                          auf Navigation und Seitentitel.
                        </p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="points_label">Punkte</Label>
                          <Input
                            defaultValue={team.pointsLabel ?? ""}
                            id="points_label"
                            name="points_label"
                            placeholder="Teampunkte"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="awards_label">Auszeichnungen</Label>
                          <Input
                            defaultValue={team.awardsLabel ?? ""}
                            id="awards_label"
                            name="awards_label"
                            placeholder="Auszeichnungen"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="links_label">Vereinslinks</Label>
                          <Input
                            defaultValue={team.linksLabel ?? ""}
                            id="links_label"
                            name="links_label"
                            placeholder="Vereinslinks"
                          />
                        </div>
                      </div>
                    </div>

                    <Button type="submit">Workspace speichern</Button>
                  </form>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{team.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Saison</p>
                      <p className="font-medium">{team.season ?? "Offen"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Altersklasse
                      </p>
                      <p className="font-medium">{team.ageGroup ?? "Offen"}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {team && canManage ? (
            <Card className="border-amber-300/70 bg-amber-50/40">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-amber-100 p-2 text-amber-800">
                    <ShieldAlert aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Daten &amp; Datenschutz</CardTitle>
                    <CardDescription>
                      Exportiere zuerst ein vollständiges Archiv oder lösche
                      diesen Workspace dauerhaft.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border border-border bg-background p-4">
                  <h3 className="font-medium">Aufbewahrungsregeln</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Alte Gesundheits- und Kommunikationsdaten werden täglich
                    automatisch gemäß diesen Fristen entfernt.
                  </p>
                  <form action={updateRetentionPolicy} className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="health-retention-days">
                          Gesundheitsdaten (Tage)
                        </Label>
                        <Input
                          defaultValue={team.healthRetentionDays}
                          id="health-retention-days"
                          max={3650}
                          min={30}
                          name="health_retention_days"
                          required
                          type="number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="data-retention-days">
                          Kommunikation &amp; Audit (Tage)
                        </Label>
                        <Input
                          defaultValue={team.dataRetentionDays}
                          id="data-retention-days"
                          max={3650}
                          min={30}
                          name="data_retention_days"
                          required
                          type="number"
                        />
                      </div>
                    </div>
                    <Button type="submit" variant="outline">
                      Fristen speichern
                    </Button>
                  </form>
                </div>

                <div className="rounded-xl border border-border bg-background p-4">
                  <h3 className="font-medium">Workspace exportieren</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    JSON-Archiv mit Team-, Spieler-, Trainings-, Spiel- und
                    Gesundheitsdaten. Passwörter und Zugriffsschlüssel werden
                    niemals mitexportiert.
                  </p>
                  <Button asChild className="mt-4" variant="outline">
                    <a href="/api/workspace/export">
                      <Download aria-hidden="true" className="h-4 w-4" />
                      Datenarchiv herunterladen
                    </a>
                  </Button>
                </div>

                <div className="rounded-xl border border-border bg-background p-4">
                  <h3 className="font-medium">Letzte Sicherheitsereignisse</h3>
                  <div className="mt-3 space-y-2">
                    {auditLogs.length > 0 ? (
                      auditLogs.map((entry) => (
                        <div
                          className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-xs"
                          key={entry.id}
                        >
                          <span className="font-medium">
                            {entry.event
                              .replaceAll(".", " ")
                              .replace("workspace", "Workspace")
                              .replace("player", "Spieler")}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatDateTime(entry.createdAt.toISOString())}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Noch keine Sicherheitsereignisse vorhanden.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-destructive/35 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2 text-destructive">
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    <h3 className="font-semibold">
                      Workspace dauerhaft löschen
                    </h3>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Dabei werden alle Spieler, Trainings, Spiele, Auswertungen
                    und privaten Medien dieses Workspaces gelöscht. Dieser
                    Vorgang kann nicht rückgängig gemacht werden.
                  </p>
                  <form action={deleteWorkspace} className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="delete-workspace-name">
                        Zur Bestätigung „{team.name}“ eingeben
                      </Label>
                      <Input
                        autoComplete="off"
                        id="delete-workspace-name"
                        name="workspace_name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="delete-workspace-password">
                        Aktuelles Passwort
                      </Label>
                      <Input
                        autoComplete="current-password"
                        id="delete-workspace-password"
                        name="password"
                        required
                        type="password"
                      />
                    </div>
                    <Button type="submit" variant="destructive">
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      Workspace endgültig löschen
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Neuen Workspace erstellen</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createTeam} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-name">Workspace</Label>
                  <Input
                    id="new-name"
                    name="name"
                    placeholder="Zug 94 U16"
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-season">Saison</Label>
                    <Input id="new-season" name="season" placeholder="2026/27" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-age">Altersklasse</Label>
                    <Input id="new-age" name="age_group" placeholder="U16" />
                  </div>
                </div>
                <Button className="w-full" type="submit">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Workspace erstellen
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Per Code beitreten</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={joinTeamWithInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Invite-Code</Label>
                  <Input
                    autoComplete="off"
                    id="code"
                    name="code"
                    placeholder="AB12CD34EF"
                    required
                  />
                </div>
                <Button className="w-full" type="submit" variant="secondary">
                  <KeyRound aria-hidden="true" className="h-4 w-4" />
                  Workspace beitreten
                </Button>
              </form>
            </CardContent>
          </Card>

          {team ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Trainerteam</CardTitle>
                  <Badge variant="secondary">
                    <UsersRound aria-hidden="true" className="mr-1 h-3 w-3" />
                    {memberCount}
                  </Badge>
                </div>
                <CardDescription>
                  Co-Trainer arbeiten im selben Datenraum.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {canManage ? (
                  <form action={createTeamInvite} className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="role">Einladen als</Label>
                      <select
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        defaultValue="coach"
                        id="role"
                        name="role"
                      >
                        <option value="coach">Coach</option>
                        <option value="assistant">Assistent</option>
                      </select>
                    </div>
                    <Button className="w-full" type="submit" variant="outline">
                      <Building2 aria-hidden="true" className="h-4 w-4" />
                      Invite-Code erzeugen
                    </Button>
                  </form>
                ) : null}

                {invites.length > 0 ? (
                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div
                        className="rounded-xl border border-border bg-background/70 px-3 py-3"
                        key={invite.id}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <code className="rounded-lg bg-slate-950 px-2 py-1 text-sm font-semibold text-white">
                            {invite.code}
                          </code>
                          <Badge variant={invite.used_at ? "secondary" : "success"}>
                            {invite.used_at ? "Benutzt" : invite.role}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Gültig bis {formatDateTime(invite.expires_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
