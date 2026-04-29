import Link from "next/link";
import { ArrowUpRight, Save, Trash2, UserPlus } from "lucide-react";
import { createPlayer, deletePlayer, updatePlayer } from "@/app/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const { supabase, user } = await requireUser();
  const { data: players, error } = await supabase
    .from("players")
    .select("id,name,position,notes,created_at,updated_at,user_id")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Create profiles and keep player notes in one place."
        title="Players"
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Add player</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createPlayer} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input id="position" name="position" placeholder="CM, CB, ST" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" />
              </div>
              <Button className="w-full" type="submit">
                <UserPlus aria-hidden="true" className="h-4 w-4" />
                Add player
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {players && players.length > 0 ? (
            players.map((player) => (
              <Card key={player.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{player.name}</CardTitle>
                      {player.position ? (
                        <Badge className="mt-2" variant="secondary">
                          {player.position}
                        </Badge>
                      ) : null}
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/players/${player.id}`}>
                        Profile
                        <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form action={updatePlayer} className="space-y-4">
                    <input name="id" type="hidden" value={player.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`name-${player.id}`}>Name</Label>
                        <Input
                          defaultValue={player.name}
                          id={`name-${player.id}`}
                          name="name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`position-${player.id}`}>
                          Position
                        </Label>
                        <Input
                          defaultValue={player.position ?? ""}
                          id={`position-${player.id}`}
                          name="position"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`notes-${player.id}`}>Notes</Label>
                      <Textarea
                        defaultValue={player.notes ?? ""}
                        id={`notes-${player.id}`}
                        name="notes"
                      />
                    </div>
                    <Button type="submit" variant="secondary">
                      <Save aria-hidden="true" className="h-4 w-4" />
                      Save
                    </Button>
                  </form>

                  <form action={deletePlayer}>
                    <input name="id" type="hidden" value={player.id} />
                    <Button size="sm" type="submit" variant="ghost">
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      Delete
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyState
              body="Add your first player to start planning training attendance and feedback."
              title="No players yet."
            />
          )}
        </div>
      </div>
    </div>
  );
}
