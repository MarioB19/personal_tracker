import type { ElementType, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sección plegable accesible (details/summary) con el estilo de la plataforma. */
export function Disclosure({
  title,
  description,
  icon: Icon,
  defaultOpen = false,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ElementType;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={cn("surface group overflow-hidden", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          ) : null}
          <span className="min-w-0">
            <span className="block text-sm font-bold text-zinc-100">{title}</span>
            {description ? <span className="block text-xs text-zinc-500">{description}</span> : null}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-4 border-t border-white/[0.05] p-3 sm:p-4">{children}</div>
    </details>
  );
}
