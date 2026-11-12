"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Selector de opciones (años, vistas, contextos) con estado activo claro.
 * Semántica de grupo de radio: Tab entra a la opción activa y las flechas,
 * Inicio y Fin cambian de opción, como en un control nativo.
 */
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
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.disabled);
  const hasActive = options.some((option) => option.value === value && !option.disabled);

  const move = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (enabled.length === 0) return;
    const position = enabled.findIndex(({ index }) => index === currentIndex);
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (position + 1) % enabled.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (position - 1 + enabled.length) % enabled.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = enabled[next];
    onChange(target.option.value);
    buttonsRef.current[target.index]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]",
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        const focusable = active || (!hasActive && enabled[0]?.index === index);
        return (
          <button
            key={String(option.value)}
            ref={(node) => {
              buttonsRef.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={focusable ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              "whitespace-nowrap rounded-lg font-semibold transition-colors disabled:opacity-40",
              size === "sm" ? "min-h-[30px] px-2.5 py-1 text-xs" : "min-h-[34px] px-3 py-1.5 text-[13px]",
              active
                ? "bg-gradient-to-b from-white/[0.14] to-white/[0.07] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.5)]"
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
