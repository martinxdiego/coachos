interface EmptyStateProps {
  title: string;
  body?: string;
}

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/40 p-8 text-center">
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      {body ? (
        <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
          {body}
        </p>
      ) : null}
    </div>
  );
}
