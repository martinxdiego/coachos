import { Shield } from "lucide-react";
import { createTacticBoard } from "@/app/actions";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { TacticBoardGallery } from "@/components/tactic-board-gallery";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TacticsPage() {
  const { team } = await requireActiveTeam();
  const t = await getTranslations("pages");
  const dbBoards = await db.tacticBoard.findMany({
    where: { workspaceId: team.id },
    orderBy: { updatedAt: "desc" },
    take: 50
  });

  const boards = dbBoards.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    elements: b.elements,
    updated_at: b.updatedAt.toISOString()
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("tactics_desc")}
        title={t("tactics_title")}
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

      <TacticBoardGallery boards={boards} />
    </div>
  );
}
