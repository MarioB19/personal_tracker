import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Superficie base de la plataforma (tarjetas, secciones y tablas). */
export function Panel({
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  actions,
  children,
  className,
  bodyClassName,
  as: Tag = "section",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ElementType;
  iconClassName?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div" | "article";
}) {
  const hasHeader = Boolean(title || actions);
  return (
    <Tag className={cn("surface", className)}>
      {hasHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon ? (
              <Icon
                className={cn("h-4 w-4 shrink-0 text-amber-400", iconClassName)}
                aria-hidden="true"
              />
            ) : null}
            <div className="min-w-0">
              {title ? (
                <h2 className="truncate text-sm font-bold text-zinc-100">{title}</h2>
              ) : null}
              {subtitle ? (
                <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(hasHeader ? "p-4 sm:p-5" : "p-4 sm:p-5", bodyClassName)}>
        {children}
      </div>
    </Tag>
  );
}
