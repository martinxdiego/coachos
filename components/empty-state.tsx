interface EmptyStateProps {
  title: string;
  body?: string;
}

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white/60 p-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {body ? <p className="mt-1 text-sm text-muted-foreground">{body}</p> : null}
    </div>
  );
}
