import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireActiveTeam } from "@/lib/auth";
import { MaterialDocument } from "@/lib/pdf/material-document";
import { pdfDateString, safeFilename } from "@/lib/pdf/filename";

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

  const { supabase, team } = await requireActiveTeam();

  const [materialResult, playersResult] = await Promise.all([
    supabase
      .from("materials")
      .select("type,title,description,content")
      .eq("id", id)
      .eq("team_id", team.id)
      .maybeSingle(),
    supabase
      .from("players")
      .select("id,name,position,birth_year,jersey_number,status")
      .eq("team_id", team.id)
      .order("name", { ascending: true })
  ]);

  if (materialResult.error) {
    return NextResponse.json(
      { error: materialResult.error.message },
      { status: 500 }
    );
  }
  if (!materialResult.data) {
    return NextResponse.json(
      { error: "Material nicht gefunden" },
      { status: 404 }
    );
  }
  if (playersResult.error) {
    return NextResponse.json(
      { error: playersResult.error.message },
      { status: 500 }
    );
  }

  const material = materialResult.data;
  const players = playersResult.data ?? [];

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
