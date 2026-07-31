import { CheckCircle2, Lightbulb, MessageSquareHeart, ShieldCheck } from "lucide-react";
import { submitProductFeedback } from "@/app/actions/feedback";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({
  searchParams
}: {
  searchParams?: Promise<{ sent?: string }>;
}) {
  const { sent } = (await searchParams) ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        description="Melde einen Fehler, teile eine Idee oder sag uns, was bereits gut funktioniert. Dein Feedback wird direkt im aktuellen Workspace gespeichert."
        eyebrow="CoachOS mitgestalten"
        title="Feedback geben"
      />

      {sent === "1" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950" role="status">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Danke, dein Feedback ist angekommen.</p>
            <p className="mt-1 text-sm text-emerald-800">Es ist zusammen mit deinem Workspace gespeichert und kann gezielt ausgewertet werden.</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Was möchtest du uns sagen?</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={submitProductFeedback} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="category">Kategorie</Label>
                <select
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                  defaultValue="idea"
                  id="category"
                  name="category"
                >
                  <option value="idea">Idee oder Verbesserung</option>
                  <option value="problem">Fehler oder Problem</option>
                  <option value="praise">Was gut funktioniert</option>
                  <option value="other">Sonstiges</option>
                </select>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Wie zufrieden bist du aktuell?</legend>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <label className="cursor-pointer" key={rating}>
                      <input className="peer sr-only" name="rating" type="radio" value={rating} />
                      <span className="flex h-11 items-center justify-center rounded-xl border border-border text-sm font-semibold transition hover:border-emerald-400 peer-checked:border-emerald-600 peer-checked:bg-emerald-50 peer-checked:text-emerald-900 peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                        {rating}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Frustrierend</span>
                  <span>Sehr gut</span>
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="message">Dein Feedback</Label>
                <Textarea
                  id="message"
                  maxLength={4000}
                  minLength={10}
                  name="message"
                  placeholder="Was ist passiert oder was würde deinen Traineralltag leichter machen?"
                  required
                  rows={7}
                />
                <p className="text-xs text-muted-foreground">Bitte keine Passwörter, persönlichen Spielerlinks oder Gesundheitsdetails einfügen.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pagePath">Betroffene Seite (optional)</Label>
                <Input id="pagePath" maxLength={500} name="pagePath" placeholder="z. B. Taktikboard oder /calendar" />
              </div>

              <Button type="submit">
                <MessageSquareHeart className="h-4 w-4" />
                Feedback senden
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Lightbulb className="h-5 w-5 text-amber-600" />
              <h2 className="mt-3 font-semibold">Hilfreiches Feedback</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Nenne dein Ziel, den letzten Schritt vor dem Problem und welches Ergebnis du erwartet hast.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              <h2 className="mt-3 font-semibold">Sicher gespeichert</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Die Meldung wird deinem Konto und Workspace zugeordnet. So können Rückfragen ohne sensible Inhalte geklärt werden.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
