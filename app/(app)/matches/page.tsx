import { CalendarPlus, Save } from "lucide-react";
import { createMatch, saveMatchNotes } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
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
import { requireUser } from "@/lib/auth";
import { formatDate, todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const { supabase, user } = await requireUser();
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id,opponent,date,notes")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="space-y-6">
      <PageHeader description="Plan fixtures and keep match notes." title="Matches" />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Create match</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createMatch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="opponent">Opponent</Label>
                <Input id="opponent" name="opponent" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  defaultValue={todayIsoDate()}
                  id="date"
                  name="date"
                  required
                  type="date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" />
              </div>
              <Button className="w-full" type="submit">
                <CalendarPlus aria-hidden="true" className="h-4 w-4" />
                Create match
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {matches && matches.length > 0 ? (
            matches.map((match) => (
              <Card key={match.id}>
                <CardHeader>
                  <CardTitle>{match.opponent}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(match.date)}
                  </p>
                </CardHeader>
                <CardContent>
                  <form action={saveMatchNotes} className="space-y-4">
                    <input name="id" type="hidden" value={match.id} />
                    <div className="space-y-2">
                      <Label htmlFor={`notes-${match.id}`}>Match notes</Label>
                      <Textarea
                        defaultValue={match.notes ?? ""}
                        id={`notes-${match.id}`}
                        name="notes"
                      />
                    </div>
                    <Button type="submit" variant="secondary">
                      <Save aria-hidden="true" className="h-4 w-4" />
                      Save notes
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyState title="No matches yet." />
          )}
        </div>
      </div>
    </div>
  );
}
