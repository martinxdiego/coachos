import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  body,
  icon: Icon = Inbox,
  action,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-secondary/40 px-6 py-10 text-center",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-foreground/70"
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
        {title}
      </p>
      {body ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-6 text-muted-foreground">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
