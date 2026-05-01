import Link from "next/link";
import { BarChart3, FileDown, Save } from "lucide-react";
import { saveMatchAnalysis } from "@/app/actions";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface AnalysisPageProps {
  searchParams?: Promise<{
    match?: string;
  }>;
}

const fields = [
  ["opponent_analysis", "Gegneranalyse"],
  ["match_preparation", "Spielvorbereitung"],
  ["match_targets", "Ziele für das Spiel"],
  ["lineup_notes", "Aufstellung / Rollen"],
  ["went_well", "Was lief gut?"],
  ["needs_work", "Was lief schlecht?"],
  ["key_moments", "Wichtigste Szenen"],
  ["individual_performances", "Individuelle Spielerleistungen"],
  ["team_performance", "Teamleistung"],
  ["tactical_lessons", "Taktische Erkenntnisse"],
  ["next_training_focus", "Nächste Trainingsschwerpunkte"]
] as const;

export default async function AnalysisPage({ searchParams }: AnalysisPageProps) {
  const { supabase, team } = await requireActiveTeam();
  const resolvedSearchParams = await searchParams;
  const [matchesResult, analysesResult] = await Promise.all([
    supabase
      .from("matches")
      .select("id,date,kickoff_time,opponent,result,competition,formation,match_goals,tactical_instructions")
      .eq("team_id", team.id)
      .order("date", { ascending: false })
      .limit(50),
    supabase
      .from("match_analyses")
      .select("*")
      .eq("team_id", team.id)
      .order("updated_at", { ascending: false })
  ]);

  if (matchesResult.error) {
    throw new Error(matchesResult.error.message);
  }

  if (analysesResult.error) {
    throw new Error(analysesResult.error.message);
  }

  const matches = matchesResult.data ?? [];
  const analyses = analysesResult.data ?? [];
  const selectedMatch =
    matches.find((match) => match.id === resolvedSearchParams?.match) ??
    matches[0] ??
    null;
  const selectedAnalysis = selectedMatch
    ? analyses.find((analysis) => analysis.match_id === selectedMatch.id) ?? null
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex gap-2">
            <PrintButton />
            <Button asChild variant="outline">
              <Link href="/matches">
                <FileDown aria-hidden="true" className="h-4 w-4" />
                Spiele
              </Link>
            </Button>
          </div>
        }
        description="Spielvorbereitung, Gegneranalyse, taktische Punkte und Review je Spiel."
        title="Analyse"
      />

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Spiele</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {matches.length > 0 ? (
              matches.map((match) => {
                const hasAnalysis = analyses.some(
                  (analysis) => analysis.match_id === match.id
                );
                const isActive = selectedMatch?.id === match.id;

                return (
                  <Link
                    className={`block rounded-xl border p-4 transition hover:bg-secondary/70 ${
                      isActive
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-border bg-background/70"
                    }`}
                    href={`/analysis?match=${match.id}`}
                    key={match.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{match.opponent}</p>
                        <p
                          className={`mt-1 text-sm ${
                            isActive ? "text-slate-300" : "text-muted-foreground"
                          }`}
                        >
                          {formatDate(match.date)}
                          {match.competition ? ` · ${match.competition}` : ""}
                        </p>
                      </div>
                      <Badge variant={hasAnalysis ? "success" : "secondary"}>
                        {hasAnalysis ? "Analyse" : "Offen"}
                      </Badge>
                    </div>
                  </Link>
                );
              })
            ) : (
              <EmptyState title="Noch keine Spiele erfasst." />
            )}
          </CardContent>
        </Card>

        {selectedMatch ? (
          <Card className="print-card">
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{selectedMatch.opponent}</CardTitle>
                    {selectedMatch.result ? (
                      <Badge variant="success">{selectedMatch.result}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatDate(selectedMatch.date)}
                    {selectedMatch.kickoff_time
                      ? ` · ${selectedMatch.kickoff_time.slice(0, 5)}`
                      : ""}
                    {selectedMatch.formation
                      ? ` · ${selectedMatch.formation}`
                      : ""}
                  </p>
                </div>
                <BarChart3 aria-hidden="true" className="h-6 w-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <form action={saveMatchAnalysis} className="space-y-5">
                <input name="match_id" type="hidden" value={selectedMatch.id} />
                <div className="grid gap-4 lg:grid-cols-2">
                  {fields.map(([name, label]) => (
                    <div
                      className={
                        name === "key_moments" ||
                        name === "individual_performances" ||
                        name === "next_training_focus"
                          ? "space-y-2 lg:col-span-2"
                          : "space-y-2"
                      }
                      key={name}
                    >
                      <Label htmlFor={`analysis-${name}`}>{label}</Label>
                      <Textarea
                        defaultValue={
                          selectedAnalysis?.[name] ??
                          (name === "match_targets"
                            ? selectedMatch.match_goals ?? ""
                            : name === "match_preparation"
                              ? selectedMatch.tactical_instructions ?? ""
                              : "")
                        }
                        id={`analysis-${name}`}
                        name={name}
                      />
                    </div>
                  ))}
                </div>
                <Button type="submit">
                  <Save aria-hidden="true" className="h-4 w-4" />
                  Analyse speichern
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <EmptyState title="Waehle oder erfasse zuerst ein Spiel." />
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
