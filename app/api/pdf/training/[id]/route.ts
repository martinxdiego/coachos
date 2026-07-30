import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";
import { pdfDateString, safeFilename } from "@/lib/pdf/filename";
import { TrainingDocument } from "@/lib/pdf/training-document";
import type { TrainingPhase } from "@/lib/types";
import {
  createSignedStorageUrls,
  TRAINING_IMAGE_BUCKET
} from "@/lib/storage";
import { assertProFeature } from "@/lib/billing";

const isoDate = (value: Date) => value.toISOString().slice(0, 10);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const PDF_RENDERABLE_IMAGE_MIME = /^image\/(png|jpe?g|webp)$/i;
const PDF_IMAGE_FETCH_TIMEOUT_MS = 8000;
const PDF_IMAGE_MAX_BYTES = 12 * 1024 * 1024; // 12 MB sanity cap per image.

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      PDF_IMAGE_FETCH_TIMEOUT_MS
    );
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim();
    if (!PDF_RENDERABLE_IMAGE_MIME.test(contentType)) return null;
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0) return null;
    if (arrayBuffer.byteLength > PDF_IMAGE_MAX_BYTES) return null;
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    // Swallow network/timeout/abort — a missing image must not break the PDF.
    return null;
  }
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID fehlt" }, { status: 400 });
  }

  const { team } = await requireActiveTeam();
  await assertProFeature(team.id, "PDF-Export");

  const trainingRow = await db.training.findFirst({
    where: { id, workspaceId: team.id },
    include: {
      phases: { orderBy: { sortOrder: "asc" } }
    }
  });

  if (!trainingRow) {
    return NextResponse.json(
      { error: "Training nicht gefunden" },
      { status: 404 }
    );
  }

  const playerRows = await db.player.findMany({
    where: { workspaceId: team.id },
    select: { id: true, name: true, position: true },
    orderBy: { name: "asc" }
  });

  const training = {
    date: isoDate(trainingRow.date),
    start_time: trainingRow.startTime,
    duration_minutes: trainingRow.durationMinutes,
    location: trainingRow.location,
    focus: trainingRow.focus,
    goal: trainingRow.goal,
    age_group: team.ageGroup ?? null,
    intensity: trainingRow.intensity,
    participants: trainingRow.participants,
    notes: trainingRow.notes
  };

  const phaseImageUrls = await Promise.all(
    trainingRow.phases.map((phase) =>
      createSignedStorageUrls(
        TRAINING_IMAGE_BUCKET,
        phase.imageUrls,
        `${team.id}/`
      )
    )
  );

  // Map Prisma (camelCase) phases onto the snake_case shape the PDF expects.
  const phases = trainingRow.phases.map((phase, index) => ({
    id: phase.id,
    training_id: phase.trainingId,
    phase_type: phase.phaseType,
    title: phase.title,
    duration_minutes: phase.durationMinutes,
    description: phase.description,
    coaching_points: phase.coachingPoints,
    organization: phase.organization,
    material: phase.material,
    player_count: phase.playerCount,
    field_size: phase.fieldSize,
    variations: phase.variations,
    load_management: phase.loadManagement,
    image_urls: phaseImageUrls[index].filter(
      (url): url is string => Boolean(url)
    ),
    diagram: phase.diagram,
    sort_order: phase.sortOrder
  })) as unknown as TrainingPhase[];

  const players = playerRows;

  // Pre-fetch every phase image once, in parallel, so the PDF renderer never
  // has to do network I/O. Failed fetches are silently dropped — a deleted or
  // unreachable image must not crash the export of the rest of the training.
  const phaseImageData: Record<string, string[]> = {};
  await Promise.all(
    phases.map(async (phase) => {
      const urls = phase.image_urls ?? [];
      if (urls.length === 0) return;
      const results = await Promise.all(urls.map(fetchImageAsDataUrl));
      const usable = results.filter((value): value is string => Boolean(value));
      if (usable.length > 0) {
        phaseImageData[phase.id] = usable;
      }
    })
  );

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
      players,
      phaseImageData
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
