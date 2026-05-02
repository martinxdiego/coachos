import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireActiveTeam } from "@/lib/auth";
import { pdfDateString, safeFilename } from "@/lib/pdf/filename";
import { TrainingDocument } from "@/lib/pdf/training-document";
import type { TrainingPhase } from "@/lib/types";

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

  const [trainingResult, phasesResult, playersResult] = await Promise.all([
    supabase
      .from("training_sessions")
      .select(
        "id,date,start_time,duration_minutes,location,focus,goal,age_group,intensity,participants,notes"
      )
      .eq("id", id)
      .eq("team_id", team.id)
      .maybeSingle(),
    supabase
      .from("training_phases")
      .select("*")
      .eq("training_id", id)
      .eq("team_id", team.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("players")
      .select("id,name,position")
      .eq("team_id", team.id)
      .order("name", { ascending: true })
  ]);

  if (trainingResult.error) {
    return NextResponse.json(
      { error: trainingResult.error.message },
      { status: 500 }
    );
  }
  if (!trainingResult.data) {
    return NextResponse.json(
      { error: "Training nicht gefunden" },
      { status: 404 }
    );
  }
  if (phasesResult.error) {
    return NextResponse.json(
      { error: phasesResult.error.message },
      { status: 500 }
    );
  }
  if (playersResult.error) {
    return NextResponse.json(
      { error: playersResult.error.message },
      { status: 500 }
    );
  }

  const training = trainingResult.data;
  const phases = (phasesResult.data ?? []) as TrainingPhase[];
  const players = playersResult.data ?? [];

  const buffer = await renderToBuffer(
    TrainingDocument({
      teamName: team.name ?? "CoachOS",
      generatedAt: `Stand: ${pdfDateString()}`,
      training: {
        date: training.date,
        start_time: training.start_time,
        duration_minutes: training.duration_minutes,
        location: training.location,
        focus: training.focus,
        goal: training.goal,
        age_group: training.age_group,
        intensity: training.intensity,
        participants: training.participants,
        notes: training.notes
      },
      phases,
      players
    })
  );

  const filename = `${safeFilename([
    "training",
    training.date,
    training.focus
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
