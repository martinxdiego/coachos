import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { addFeedback } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
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
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PlayerProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PlayerProfilePage({
  params
}: PlayerProfilePageProps) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const [playerResult, feedbackResult] = await Promise.all([
    supabase
      .from("players")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("player_feedback")
      .select("*")
      .eq("player_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
  ]);

  if (playerResult.error) {
    notFound();
  }

  if (feedbackResult.error) {
    throw new Error(feedbackResult.error.message);
  }

  const player = playerResult.data;
  const feedback = feedbackResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link href="/players">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Players
            </Link>
          </Button>
        }
        title={player.name}
      />

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Position</p>
                <div className="mt-2">
                  {player.position ? (
                    <Badge variant="secondary">{player.position}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Open</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                  {player.notes || "No notes."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addFeedback} className="space-y-4">
                <input name="player_id" type="hidden" value={player.id} />
                <div className="space-y-2">
                  <Label htmlFor="rating">Rating</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue="7"
                    id="rating"
                    name="rating"
                  >
                    {Array.from({ length: 10 }, (_, index) => index + 1).map(
                      (rating) => (
                        <option key={rating} value={rating}>
                          {rating}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedback-notes">Notes</Label>
                  <Textarea id="feedback-notes" name="notes" required />
                </div>
                <Button type="submit">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Add feedback
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            {feedback.length > 0 ? (
              <div className="space-y-3">
                {feedback.map((item) => (
                  <div
                    className="rounded-lg border border-border px-4 py-3"
                    key={item.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="success">{item.rating}/10</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                      {item.notes}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No feedback yet." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
