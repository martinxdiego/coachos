import { Shield } from "lucide-react";
import { createTacticBoard } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { TacticBoardEditor } from "@/components/tactic-board-editor";
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
import { requireActiveTeam } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TacticsPage() {
  const { supabase, team } = await requireActiveTeam();
  const [boardsResult, playersResult] = await Promise.all([
    supabase
      .from("tactic_boards")
      .select("*")
      .eq("team_id", team.id)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("players")
      .select("id,name,position,jersey_number")
      .eq("team_id", team.id)
      .order("jersey_number", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
  ]);

  if (boardsResult.error) {
    throw new Error(boardsResult.error.message);
  }

  if (playersResult.error) {
    throw new Error(playersResult.error.message);
  }

  const boards = boardsResult.data ?? [];
  const players = playersResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Zeichne Formationen, Laufwege, Zonen und Notizen direkt auf dem Feld."
        title="Taktikboard"
      />

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="h-fit border-emerald-200 bg-emerald-50/70 no-print">
          <CardHeader>
            <CardTitle>Neues Board</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createTacticBoard} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Pressing 4-3-3"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea id="description" name="description" />
              </div>
              <Button className="w-full" type="submit">
                <Shield aria-hidden="true" className="h-4 w-4" />
                Board erstellen
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {boards.length > 0 ? (
            boards.map((board) => (
              <Card className="print-card" key={board.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>{board.title}</CardTitle>
                      {board.description ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {board.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="no-print">
                      <PrintButton label="Board drucken" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <TacticBoardEditor board={board} players={players} />
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyState
              body="Erstelle ein Board und platziere Spieler, Gegner, Ball, Hütchen, Pfeile und Notizen."
              title="Noch kein Taktikboard."
            />
          )}
        </div>
      </section>
    </div>
  );
}
