import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";
import { MaterialDocument, type MaterialPlayerRow } from "@/lib/pdf/material-document";
import { pdfDateString, safeFilename } from "@/lib/pdf/filename";
import type { MaterialType, PlayerStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID fehlt" }, { status: 400 });
  }

  const { team } = await requireActiveTeam();

  const materialRow = await db.material.findFirst({
    where: { id, workspaceId: team.id },
    select: { type: true, title: true, description: true, content: true }
  });

  if (!materialRow) {
    return NextResponse.json(
      { error: "Material nicht gefunden" },
      { status: 404 }
    );
  }

  const playerRows = await db.player.findMany({
    where: { workspaceId: team.id },
    select: {
      id: true,
      name: true,
      position: true,
      birthYear: true,
      jerseyNumber: true,
      status: true
    },
    orderBy: { name: "asc" }
  });

  const material = {
    type: materialRow.type as unknown as MaterialType,
    title: materialRow.title,
    description: materialRow.description,
    content: materialRow.content
  };

  const players: MaterialPlayerRow[] = playerRows.map((player) => ({
    id: player.id,
    name: player.name,
    position: player.position,
    birth_year: player.birthYear,
    jersey_number: player.jerseyNumber,
    status: player.status.toLowerCase() as PlayerStatus
  }));

  const buffer = await renderToBuffer(
    MaterialDocument({
      teamName: team.name ?? "CoachOS",
      generatedAt: `Stand: ${pdfDateString()}`,
      material,
      players
    })
  );

  const filename = `${safeFilename([
    material.type,
    material.title
  ])}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
