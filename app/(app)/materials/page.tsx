import { FileText, Save, Trash2 } from "lucide-react";
import { createMaterial, deleteMaterial, updateMaterial } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
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
import type { MaterialType } from "@/lib/types";

export const dynamic = "force-dynamic";

const materialTypes: { value: MaterialType; label: string }[] = [
  { value: "exercise_sheet", label: "Übungsblatt" },
  { value: "training_plan", label: "Trainingsplan" },
  { value: "match_plan", label: "Matchplan" },
  { value: "tactics_sheet", label: "Taktikblatt" },
  { value: "player_list", label: "Spielerliste" },
  { value: "attendance_list", label: "Anwesenheitsliste" },
  { value: "week_plan", label: "Wochenplan" },
  { value: "month_plan", label: "Monatsplan" }
];

function materialLabel(type: MaterialType) {
  return materialTypes.find((item) => item.value === type)?.label ?? type;
}

export default async function MaterialsPage() {
  const { supabase, team } = await requireActiveTeam();
  const { data: materials, error } = await supabase
    .from("materials")
    .select("*")
    .eq("team_id", team.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Erstelle druckfreundliche Pläne, Listen und Taktikblätter."
        title="Material"
      />

      <section className="grid gap-4 xl:grid-cols-[400px_1fr]">
        <Card className="h-fit border-emerald-200 bg-emerald-50/70">
          <CardHeader>
            <CardTitle>Material erstellen</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createMaterial} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Typ</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  id="type"
                  name="type"
                >
                  {materialTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
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
                <Label htmlFor="content">Inhalt</Label>
                <Textarea
                  className="min-h-44"
                  id="content"
                  name="content"
                  placeholder="Abschnitte, Listen, Coachingpunkte, Abläufe ..."
                />
              </div>
              <Button className="w-full" type="submit">
                <FileText aria-hidden="true" className="h-4 w-4" />
                Material speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {materials && materials.length > 0 ? (
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
                      <PrintButton />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {material.description ? (
                    <p className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                      {material.description}
                    </p>
                  ) : null}

                  <div className="prose max-w-none whitespace-pre-wrap rounded-xl border border-border bg-white p-5 text-sm leading-7">
                    {material.content || "Noch kein Inhalt."}
                  </div>

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

                  <form action={deleteMaterial} className="no-print">
                    <input name="id" type="hidden" value={material.id} />
                    <Button size="sm" type="submit" variant="ghost">
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      Löschen
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyState
              body="Erstelle Trainingspläne, Matchpläne, Taktikblätter, Listen und Wochenpläne."
              title="Noch kein Material."
            />
          )}
        </div>
      </section>
    </div>
  );
}
