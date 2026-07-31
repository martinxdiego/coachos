import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  Info
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireActiveTeam } from "@/lib/auth";
import {
  getCoachAttentionItems,
  type AttentionTone
} from "@/lib/coach-attention";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const toneStyles: Record<
  AttentionTone,
  { icon: typeof Bell; iconClass: string; cardClass: string }
> = {
  urgent: {
    icon: CircleAlert,
    iconClass: "bg-red-100 text-red-700",
    cardClass: "border-red-200 bg-red-50/55"
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "bg-amber-100 text-amber-800",
    cardClass: "border-amber-200 bg-amber-50/55"
  },
  info: {
    icon: Info,
    iconClass: "bg-sky-100 text-sky-700",
    cardClass: "border-border bg-card"
  },
  success: {
    icon: CheckCircle2,
    iconClass: "bg-emerald-100 text-emerald-700",
    cardClass: "border-emerald-200 bg-emerald-50/55"
  }
};

export default async function NotificationsPage() {
  const { team } = await requireActiveTeam();
  const items = await getCoachAttentionItems(team.id);
  const urgentCount = items.filter((item) => item.tone === "urgent").length;
  const warningCount = items.filter((item) => item.tone === "warning").length;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Priorisierte Signale aus Check-ins, Rückmeldungen, Aufgaben und Terminen."
        title="Aufmerksamkeitszentrale"
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">Aktuell</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{items.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">offene Signale</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-[.14em] text-red-700">Kritisch</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-red-950">{urgentCount}</p>
          <p className="mt-1 text-xs text-red-800/70">zuerst prüfen</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-[.14em] text-amber-700">Auffällig</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-amber-950">{warningCount}</p>
          <p className="mt-1 text-xs text-amber-800/70">zeitnah ansehen</p>
        </div>
      </section>

      {items.length === 0 ? (
        <EmptyState
          body="Neue Check-ins, Rückmeldungen, Aufgaben und fehlende Zusagen erscheinen automatisch hier."
          icon={CalendarCheck}
          title="Im Moment ist alles erledigt."
        />
      ) : (
        <section aria-label="Aktuelle Hinweise" className="space-y-2">
          {items.map((item) => {
            const style = toneStyles[item.tone];
            const Icon = style.icon;
            return (
              <Link
                className={cn(
                  "group flex min-h-20 items-start gap-3 rounded-2xl border p-4 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-elevated",
                  style.cardClass
                )}
                href={item.href}
                key={item.id}
              >
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.iconClass)}>
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold tracking-tight">{item.title}</span>
                    <Badge variant="secondary">{item.label}</Badge>
                  </span>
                  <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">{item.body}</span>
                </span>
                <ArrowRight aria-hidden="true" className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
