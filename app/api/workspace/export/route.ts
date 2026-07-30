import { NextResponse } from "next/server";
import { requireActiveTeam } from "@/lib/auth";
import { buildWorkspaceExport } from "@/lib/workspace-export";
import { workspaceExportFilename } from "@/lib/workspace-export-filename";
import { recordAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { user, team, membership } = await requireActiveTeam();
  if (membership.role !== "OWNER") {
    return NextResponse.json(
      { error: "Nur der Workspace-Owner darf Daten exportieren." },
      { status: 403 }
    );
  }

  const archive = await buildWorkspaceExport(team.id);
  await recordAuditEvent({
    workspaceId: team.id,
    event: "workspace.export.downloaded",
    actorUserId: user.id,
    targetType: "Workspace",
    targetId: team.id
  });
  const body = JSON.stringify(archive, null, 2);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${workspaceExportFilename(
        team.name
      )}"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
