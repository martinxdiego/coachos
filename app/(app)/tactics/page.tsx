import { Shield } from "lucide-react";
import { createTacticBoard } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { TacticBoardAccordion } from "@/components/tactic-board-accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TacticsPage() {
  const { team } = await requireActiveTeam();
  const [dbBoards, dbPlayers] = await Promise.all([
    db.tacticBoard.findMany({
      where: { workspaceId: team.id },
      orderBy: { updatedAt: "desc" },
      take: 50
    }),
    db.player.findMany({
      where: { workspaceId: team.id },
      select: {
        id: true,
        name: true,
        position: true,
        jerseyNumber: true
      },
      orderBy: [
        { jerseyNumber: "asc" },
        { name: "asc" }
      ]
    })
  ]);

  const boards = dbBoards.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    elements: b.elements,
    updated_at: b.updatedAt.toISOString()
  }));

  const players = dbPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    jersey_number: p.jerseyNumber
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        description="Zeichne Formationen, Laufwege, Zonen und Notizen direkt auf dem Feld."
        title="Taktikboard"
      />

      {/* Compact create form */}
      <Card className="no-print border-emerald-200 bg-emerald-50/70">
        <CardContent className="py-3">
          <form action={createTacticBoard} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="title">Titel</Label>
              <Input id="title" name="title" placeholder="z.B. Pressing 4-3-3" required />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Input id="description" name="description" />
            </div>
            <Button className="shrink-0" type="submit">
              <Shield className="h-4 w-4" />
              Board erstellen
            </Button>
          </form>
        </CardContent>
      </Card>

      <TacticBoardAccordion boards={boards} players={players} />
    </div>
  );
}
