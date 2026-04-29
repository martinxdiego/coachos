import Link from "next/link";
import { ArrowRight, CalendarCheck, MessageSquare, Trophy, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, todayIsoDate } from "@/lib/utils";
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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const today = todayIsoDate();

  const [
    playerCountResult,
    nextTrainingResult,
    nextMatchResult,
    recentTrainingsResult,
    recentMatchesResult,
    recentFeedbackResult
  ] = await Promise.all([
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("training_sessions")
      .select("id,date,focus,notes")
      .eq("user_id", user.id)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("matches")
      .select("id,date,opponent,notes")
      .eq("user_id", user.id)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("training_sessions")
      .select("id,focus,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("matches")
      .select("id,opponent,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("player_feedback")
      .select("id,rating,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3)
  ]);

  for (const result of [
    playerCountResult,
    nextTrainingResult,
    nextMatchResult,
    recentTrainingsResult,
    recentMatchesResult,
    recentFeedbackResult
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const recentActivity = [
    ...(recentTrainingsResult.data ?? []).map((item) => ({
      id: `training-${item.id}`,
      label: "Training",
      title: item.focus,
      createdAt: item.created_at
    })),
    ...(recentMatchesResult.data ?? []).map((item) => ({
      id: `match-${item.id}`,
      label: "Match",
      title: item.opponent,
      createdAt: item.created_at
    })),
    ...(recentFeedbackResult.data ?? []).map((item) => ({
      id: `feedback-${item.id}`,
      label: "Feedback",
      title: `Rating ${item.rating}/10`,
      createdAt: item.created_at
    }))
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  const nextTraining = nextTrainingResult.data;
  const nextMatch = nextMatchResult.data;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Today’s coaching overview."
        title="Dashboard"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Players
            </CardTitle>
            <UsersRound aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {playerCountResult.count ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Next training
            </CardTitle>
            <CalendarCheck aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            {nextTraining ? (
              <>
                <div className="text-lg font-semibold">{nextTraining.focus}</div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(nextTraining.date)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No training planned.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Next match
            </CardTitle>
            <Trophy aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            {nextMatch ? (
              <>
                <div className="text-lg font-semibold">{nextMatch.opponent}</div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(nextMatch.date)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No match planned.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((item) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3"
                    key={item.id}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{item.label}</Badge>
                        <p className="truncate text-sm font-medium">
                          {item.title}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                    <MessageSquare
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No activity yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next step</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-between" variant="outline">
              <Link href="/players">
                Manage players
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="w-full justify-between" variant="outline">
              <Link href="/trainings">
                Plan training
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="w-full justify-between" variant="outline">
              <Link href="/matches">
                Plan match
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
