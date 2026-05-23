import { FileText, Save, Trash2 } from "lucide-react";
import { createMaterial, deleteMaterial, updateMaterial } from "@/app/actions";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { EmptyState } from "@/components/empty-state";
import { MaterialTypePicker } from "@/components/material-type-picker";
import { PageHeader } from "@/components/page-header";
import { PdfDownloadButton } from "@/components/pdf-download-button";
import { ToastForm } from "@/components/toast-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireActiveTeam } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import type { MaterialType, Player, PlayerStatus } from "@/lib/types";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const materialTypes: { value: MaterialType; label: string; hint: string }[] = [
  {
    value: "exercise_sheet",
    label: "Übungsblatt",
    hint: "Ziel, Organisation, Ablauf, Coachingpunkte und Varianten."
  },
  {
    value: "training_plan",
    label: "Trainingsplan",
    hint: "Füllt sich mit deinem letzten Training und den Phasen."
  },
  {
    value: "match_plan",
    label: "Matchplan",
    hint: "Füllt sich mit deinem nächsten Spiel."
  },
  {
    value: "tactics_sheet",
    label: "Taktikblatt",
    hint: "Enthält eine druckbare Taktiktafel."
  },
  {
    value: "player_list",
    label: "Spielerliste",
    hint: "Übernimmt automatisch alle Spieler im Workspace."
  },
  {
    value: "attendance_list",
    label: "Anwesenheitsliste",
    hint: "Übernimmt alle Spieler mit Checkboxen zum Abhaken."
  },
  {
    value: "week_plan",
    label: "Wochenplan",
    hint: "Sortiert Trainings und Spiele nach Datum."
  },
  {
    value: "month_plan",
    label: "Monatsplan",
    hint: "Sortiert deine kommenden Termine als Monatsübersicht."
  }
];

function materialLabel(type: MaterialType) {
  return materialTypes.find((item) => item.value === type)?.label ?? type;
}

function MaterialBody({
  content,
  players,
  type
}: {
  content: string | null;
  players: Pick<
    Player,
    "id" | "name" | "position" | "birth_year" | "jersey_number" | "status"
  >[];
  type: MaterialType;
}) {
  if (type === "player_list") {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Nr.</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Position</th>
              <th className="px-3 py-2 text-left">Jahrgang</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr className="border-t border-border" key={player.id}>
                <td className="px-3 py-2">{player.jersey_number ?? "-"}</td>
                <td className="px-3 py-2 font-medium">{player.name}</td>
                <td className="px-3 py-2">{player.position ?? "-"}</td>
                <td className="px-3 py-2">{player.birth_year ?? "-"}</td>
                <td className="px-3 py-2">{player.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === "attendance_list") {
    return (
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {players.map((player) => (
            <label
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3 text-sm"
              key={player.id}
            >
              <span>
                <span className="font-medium">{player.name}</span>
                <span className="ml-2 text-muted-foreground">
                  {player.position ?? "-"} · #{player.jersey_number ?? "-"}
                </span>
              </span>
              <input className="h-4 w-4" type="checkbox" />
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (type === "tactics_sheet") {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="relative aspect-[1.55] min-h-72 rounded-2xl border-4 border-emerald-950/10 bg-emerald-700 [print-color-adjust:exact]">
          <div className="absolute inset-4 rounded-2xl border-2 border-white/70" />
          <div className="absolute left-1/2 top-4 h-[calc(100%-2rem)] border-l-2 border-white/60" />
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
          <div className="absolute left-4 top-1/2 h-32 w-20 -translate-y-1/2 border-2 border-l-0 border-white/60" />
          <div className="absolute right-4 top-1/2 h-32 w-20 -translate-y-1/2 border-2 border-r-0 border-white/60" />
          {["6", "8", "10", "7", "9", "11"].map((label, index) => (
            <div
              className="absolute flex h-10 w-10 items-center justify-center rounded-full border border-white bg-slate-950 text-xs font-semibold text-white [print-color-adjust:exact]"
              key={label}
              style={{
                left: `${30 + (index % 3) * 18}%`,
                top: `${38 + Math.floor(index / 3) * 24}%`
              }}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="whitespace-pre-wrap rounded-xl border border-border bg-white p-5 text-sm leading-7">
          {content || "Taktische Prinzipien und Notizen."}
        </div>
      </div>
    );
  }

  return (
    <div className="whitespace-pre-wrap rounded-xl border border-border bg-white p-5 text-sm leading-7">
      {content || "Noch kein Inhalt."}
    </div>
  );
}

export default async function MaterialsPage() {
  const { team } = await requireActiveTeam();
  const [materialsData, playersData] = await Promise.all([
    db.material.findMany({
      where: { workspaceId: team.id },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    db.player.findMany({
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
    })
  ]);

  const materials = materialsData.map((m) => ({
    id: m.id,
    title: m.title,
    type: m.type as MaterialType,
    description: m.description,
    content: m.content,
    created_at: m.createdAt.toISOString()
  }));

  const players = playersData.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    birth_year: p.birthYear,
    jersey_number: p.jerseyNumber,
    status: (p.status === "FIT" ? "available" : p.status === "INJURED" ? "injured" : p.status === "REHAB" ? "limited" : p.status.toLowerCase()) as PlayerStatus
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        description="Erstelle druckfreundliche Pläne, Listen und Taktikblätter mit passenden Vorlagen."
        title="Material"
      />

      <section className="grid gap-4 xl:grid-cols-[400px_1fr]">
        <Card className="h-fit border-emerald-200 bg-emerald-50/70">
          <CardHeader>
            <CardTitle>Material erstellen</CardTitle>
          </CardHeader>
          <CardContent>
            <ToastForm
              action={createMaterial}
              className="space-y-4"
              successMessage="Material gespeichert"
            >
              <div className="space-y-2">
                <Label>Vorlage</Label>
                <MaterialTypePicker />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Wochenplan KW 12"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Kurzbeschreibung</Label>
                <Input id="description" name="description" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Eigene Ergänzung optional</Label>
                <Textarea
                  className="min-h-32"
                  id="content"
                  name="content"
                  placeholder="Leer lassen, wenn CoachOS die passende Vorlage automatisch füllen soll."
                />
              </div>
              <Button className="w-full" type="submit">
                <FileText aria-hidden="true" className="h-4 w-4" />
                Material speichern
              </Button>
            </ToastForm>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {materials.length > 0 ? (
            materials.map((material) => (
              <Card className="print-card overflow-hidden" key={material.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{material.title}</CardTitle>
                        <Badge variant="secondary">
                          {materialLabel(material.type)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {formatDateTime(material.created_at)}
                      </p>
                    </div>
                    <div className="no-print">
                      <PdfDownloadButton
                        href={`/api/pdf/material/${material.id}`}
                        label="PDF herunterladen"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {material.description ? (
                    <p className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                      {material.description}
                    </p>
                  ) : null}

                  <MaterialBody
                    content={material.content}
                    players={players}
                    type={material.type}
                  />

                  <details className="rounded-xl border border-border p-4 no-print">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Material bearbeiten
                    </summary>
                    <form action={updateMaterial} className="mt-4 space-y-4">
                      <input name="id" type="hidden" value={material.id} />
                      <Input
                        defaultValue={material.title}
                        name="title"
                        required
                      />
                      <Input
                        defaultValue={material.description ?? ""}
                        name="description"
                        placeholder="Beschreibung"
                      />
                      <Textarea
                        className="min-h-44"
                        defaultValue={material.content ?? ""}
                        name="content"
                      />
                      <Button type="submit">
                        <Save aria-hidden="true" className="h-4 w-4" />
                        Speichern
                      </Button>
                    </form>
                  </details>

                  <ConfirmDeleteForm
                    action={deleteMaterial}
                    className="no-print"
                    confirm={{
                      title: "Material löschen?",
                      description: `"${material.title}" wird unwiderruflich entfernt.`
                    }}
                    successMessage="Material gelöscht"
                    errorMessage="Material konnte nicht gelöscht werden."
                  >
                    <input name="id" type="hidden" value={material.id} />
                    <Button size="sm" type="submit" variant="ghost">
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      Löschen
                    </Button>
                  </ConfirmDeleteForm>
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyState
              body="Erstelle Trainingspläne, Matchpläne, Taktikblätter, Listen und Wochenpläne. Die Inhalte werden je nach Typ automatisch vorbereitet."
              icon={FileText}
              title="Noch kein Material."
            />
          )}
        </div>
      </section>
    </div>
  );
}
