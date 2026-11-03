"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Selector de opciones (años, vistas, contextos) con estado activo claro. */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className,
}: {
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "whitespace-nowrap rounded-lg font-semibold transition-colors disabled:opacity-40",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
              active
                ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
