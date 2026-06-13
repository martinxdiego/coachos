import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";
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

  const { team } = await requireActiveTeam();

  const matchRow = await db.match.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!matchRow) {
    return NextResponse.json(
      { error: "Spiel nicht gefunden" },
      { status: 404 }
    );
  }

  const match = {
    opponent: matchRow.opponent,
    date: matchRow.date.toISOString().slice(0, 10),
    kickoff_time: matchRow.kickoffTime,
    location: matchRow.location,
    home_away: matchRow.homeAway ?? (matchRow.home ? "home" : "away"),
    competition: matchRow.competition,
    team_category: team.age_group ?? null,
    meeting_point: matchRow.meetingPoint,
    formation: matchRow.formation,
    starting_lineup: matchRow.startingLineup,
    substitutes: matchRow.substitutes,
    tactical_instructions: matchRow.tacticalInstructions,
    match_goals: matchRow.matchGoals,
    pre_match_notes: matchRow.preMatchNotes,
    halftime_notes: matchRow.halftimeNotes,
    post_match_notes: matchRow.postMatchNotes,
    squad_notes: matchRow.squadNotes,
    notes: matchRow.notes,
    result: matchRow.result,
    scorers: matchRow.scorers,
    assists: matchRow.assists,
    cards: matchRow.cards
  };

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
