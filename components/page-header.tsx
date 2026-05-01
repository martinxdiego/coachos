interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {eyebrow ? (
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[32px]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-[14px] leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
