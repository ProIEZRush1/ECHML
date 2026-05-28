import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-6 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.025em] m-0">{title}</h1>
        {description && (
          <p className="mt-1.5 text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
