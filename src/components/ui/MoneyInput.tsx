"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const GROUPED = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[\s,$]/g, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

/**
 * Monto editable: muestra separadores de miles cuando no tiene foco y el
 * número limpio al editar. Acepta pegar "12,500" o "$12,500".
 */
export function MoneyInput({
  value,
  onChange,
  ariaLabel,
  className,
  placeholder = "—",
  variant = "cell",
}: {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
  variant?: "cell" | "field";
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const valueOnFocus = useRef(value);
  const display = draft ?? (value ? GROUPED.format(value) : "");

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={display}
      onFocus={(event) => {
        valueOnFocus.current = value;
        setDraft(value ? String(value) : "");
        requestAnimationFrame(() => event.target.select());
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = parseAmount(event.target.value);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        if (event.key === "Escape") {
          if (value !== valueOnFocus.current) onChange(valueOnFocus.current);
          setDraft(null);
          (event.target as HTMLInputElement).blur();
        }
      }}
      className={cn(
        variant === "cell"
          ? "grid-cell-input"
          : "h-9 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 text-right font-mono text-sm text-zinc-100 outline-none transition-colors focus:border-amber-500/40",
        className,
      )}
    />
  );
}
