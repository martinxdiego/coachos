import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireActiveTeam } from "@/lib/auth";
import { MatchDocument } from "@/lib/pdf/match-document";
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

  const { data: match, error } = await supabase
    .from("matches")
    .select(
      "opponent,date,kickoff_time,location,home_away,competition,team_category,meeting_point,formation,starting_lineup,substitutes,tactical_instructions,match_goals,pre_match_notes,halftime_notes,post_match_notes,squad_notes,notes,result,scorers,assists,cards"
    )
    .eq("id", id)
    .eq("team_id", team.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!match) {
    return NextResponse.json(
      { error: "Spiel nicht gefunden" },
      { status: 404 }
    );
  }

  const buffer = await renderToBuffer(
    MatchDocument({
      teamName: team.name ?? "CoachOS",
      generatedAt: `Stand: ${pdfDateString()}`,
      match
    })
  );

  const filename = `${safeFilename([
    "spielplan",
    match.date,
    match.opponent
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
