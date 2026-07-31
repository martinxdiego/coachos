import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { TacticBoardWorkspace } from "@/components/tactic-board-workspace";
import { Button } from "@/components/ui/button";
import { requireActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TacticBoardPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { team } = await requireActiveTeam();
  const [board, dbPlayers] = await Promise.all([
    db.tacticBoard.findFirst({ where: { id, workspaceId: team.id } }),
    db.player.findMany({
      where: { workspaceId: team.id },
      select: { id: true, name: true, position: true, jerseyNumber: true },
      orderBy: [{ jerseyNumber: "asc" }, { name: "asc" }]
    })
  ]);

  if (!board) notFound();

  const players = dbPlayers.map((player) => ({
    id: player.id,
    name: player.name,
    position: player.position,
    jersey_number: player.jerseyNumber
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/tactics">
              <ArrowLeft className="h-4 w-4" />
              Alle Boards
            </Link>
          </Button>
        }
        description="Plane Spielzüge, prüfe Abläufe als Animation und präsentiere sie deiner Mannschaft."
        eyebrow="Taktikboard"
        title={board.title}
      />

      <TacticBoardWorkspace
        board={{
          id: board.id,
          title: board.title,
          description: board.description,
          elements: board.elements
        }}
        players={players}
      />
    </div>
  );
}
