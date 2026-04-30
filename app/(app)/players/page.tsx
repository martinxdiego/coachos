import Link from "next/link";
import { ArrowUpRight, Plus, Shirt, UserRound, UsersRound } from "lucide-react";
import { createPlayer, deletePlayer } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireActiveTeam } from "@/lib/auth";

export const dynamic = "force-dynamic";

function statusBadge(status: string) {
  if (status === "injured") {
    return <Badge variant="destructive">Verletzt</Badge>;
  }

  if (status === "limited") {
    return <Badge variant="secondary">Aufbau</Badge>;
  }

  if (status === "absent") {
    return <Badge variant="outline">Abwesend</Badge>;
  }

  return <Badge variant="success">Fit</Badge>;
}

export default async function PlayersPage() {
  const { supabase, team } = await requireActiveTeam();
  const { data: players, error } = await supabase
    .from("players")
    .select(
      "id,name,first_name,last_name,position,birth_year,jersey_number,status,rating,development_goals,updated_at"
    )
    .eq("team_id", team.id)
    .order("last_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const playerList = players ?? [];
  const grouped = playerList.reduce<Record<string, typeof playerList>>(
    (acc, player) => {
      const key = player.position ?? "Ohne Position";
      acc[key] = [...(acc[key] ?? []), player];
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <PageHeader
        description="Schnell erfassen, später detailliert entwickeln."
        title="Spieler"
      />

      <section className="space-y-4">
        <Card className="border-emerald-200 bg-emerald-50/70">
          <CardHeader>
            <CardTitle>Schnellerstellung</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createPlayer} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-5">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Vorname</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    placeholder="Luca"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nachname</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    placeholder="Meier"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Input id="position" name="position" placeholder="ZM, IV, ST" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birth_year">Jahrgang</Label>
                  <Input
                    id="birth_year"
                    name="birth_year"
                    placeholder="2010"
                    type="number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jersey_number">Rückennummer</Label>
                  <Input
                    id="jersey_number"
                    name="jersey_number"
                    placeholder="8"
                    type="number"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-emerald-900/70">
                  Diese fünf Felder reichen für den Kader. Details folgen später im Profil.
                </p>
                <Button type="submit">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Spieler speichern
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {playerList.length > 0 ? (
            Object.entries(grouped).map(([position, items]) => (
              <Card key={position}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{position}</CardTitle>
                    <Badge variant="secondary">{items.length} Spieler</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((player) => (
                    <div
                      className="rounded-xl border border-border bg-background/75 p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white hover:shadow-soft"
                      key={player.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                            {player.jersey_number ? (
                              <span className="font-semibold">
                                {player.jersey_number}
                              </span>
                            ) : (
                              <UserRound
                                aria-hidden="true"
                                className="h-5 w-5"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">
                              {player.name}
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {statusBadge(player.status)}
                              {player.rating ? (
                                <Badge variant="secondary">
                                  {player.rating}/10
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <Button asChild size="icon" variant="ghost">
                          <Link href={`/players/${player.id}`}>
                            <ArrowUpRight
                              aria-hidden="true"
                              className="h-4 w-4"
                            />
                          </Link>
                        </Button>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-secondary px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            Jahrgang
                          </p>
                          <p className="font-medium">
                            {player.birth_year ?? "Offen"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-secondary px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            Nummer
                          </p>
                          <p className="font-medium">
                            {player.jersey_number ?? "Offen"}
                          </p>
                        </div>
                      </div>

                      {player.development_goals ? (
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {player.development_goals}
                        </p>
                      ) : null}

                      <form action={deletePlayer} className="mt-4">
                        <input name="id" type="hidden" value={player.id} />
                        <Button size="sm" type="submit" variant="ghost">
                          Entfernen
                        </Button>
                      </form>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyState
              body="Starte mit Vorname, Nachname, Position, Jahrgang und Nummer. Der Detailausbau folgt im Profil."
              title="Noch keine Spieler im Workspace."
            />
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <Shirt aria-hidden="true" className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">Schnell erfassen</p>
            <p className="mt-1 text-sm text-muted-foreground">
              In Sekunden ist ein Spieler im Kader.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <UserRound aria-hidden="true" className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">Details später</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Profil, Entwicklung, Kontakte und medizinische Hinweise getrennt.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <UsersRound aria-hidden="true" className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">Teamweit sichtbar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Alle Trainer im Workspace sehen dieselben Daten.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
