interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-white/70 p-5 shadow-sm shadow-slate-950/5 backdrop-blur sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
