"use client";

import { cn, formatCurrency } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export type MonthlyCloseConfidence =
  | "CONFIRMED"
  | "OPEN"
  | "INCOMPLETE"
  | "MANUAL"
  | "LOADING"
  | "KNOWN_ONLY";

type Props = {
  monthLabel: string;
  revenue: number;
  adSpend: number;
  fixedExpenses: number;
  otherOperatingExpenses: number;
  netResult: number;
  healthStatus: "BIEN" | "ATENCION" | "MAL";
  confidence: MonthlyCloseConfidence;
  confidenceDetail: string;
};

const confidencePresentation: Record<
  MonthlyCloseConfidence,
  {
    label: string;
    eyebrow: string;
    icon: typeof CheckCircle2;
    tone: string;
  }
> = {
  CONFIRMED: {
    label: "Datos confirmados",
    eyebrow: "Cierre confirmado",
    icon: CheckCircle2,
    tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  },
  OPEN: {
    label: "Mes abierto · estimación",
    eyebrow: "Resultado al corte",
    icon: Clock3,
    tone: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  },
  INCOMPLETE: {
    label: "Fuentes por completar",
    eyebrow: "Cierre estimado",
    icon: AlertTriangle,
    tone: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  },
  MANUAL: {
    label: "Respaldo manual",
    eyebrow: "Cierre con respaldo",
    icon: CheckCircle2,
    tone: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  },
  LOADING: {
    label: "Actualizando fuentes",
    eyebrow: "Resultado preliminar",
    icon: Clock3,
    tone: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  },
  KNOWN_ONLY: {
    label: "Solo gastos conocidos",
    eyebrow: "Resultado preliminar",
    icon: AlertTriangle,
    tone: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300",
  },
};

function signedCurrency(value: number): string {
  return value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value);
}

export default function MonthlyBusinessCloseCard({
  monthLabel,
  revenue,
  adSpend,
  fixedExpenses,
  otherOperatingExpenses,
  netResult,
  healthStatus,
  confidence,
  confidenceDetail,
}: Props) {
  const confidenceUI = confidencePresentation[confidence];
  const ConfidenceIcon = confidenceUI.icon;
  const isPositive = netResult > 0;
  const isNegative = netResult < 0;
  const financialStatusLabel =
    healthStatus === "BIEN"
      ? "Salud financiera: bien"
      : healthStatus === "ATENCION"
        ? "Salud financiera: atención"
        : "Salud financiera: mal";
  const financialStatusTone =
    healthStatus === "BIEN"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : healthStatus === "ATENCION"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
        : "border-red-500/20 bg-red-500/10 text-red-300";

  return (
    <section
      className={cn(
        "glass-card overflow-hidden rounded-3xl border bg-[#0c0c0e]/95 shadow-2xl",
        isPositive
          ? "border-emerald-500/25"
          : isNegative
            ? "border-red-500/25"
            : "border-white/10",
      )}
      aria-labelledby="monthly-business-close-title"
    >
      <div
        className={cn(
          "grid gap-6 bg-gradient-to-br p-6 sm:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-center",
          isPositive
            ? "from-emerald-950/35 via-[#0c0c0e] to-emerald-900/5"
            : isNegative
              ? "from-red-950/35 via-[#0c0c0e] to-red-900/5"
              : "from-zinc-900/35 via-[#0c0c0e] to-zinc-900/5",
        )}
      >
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
            {confidenceUI.eyebrow}
          </p>
          <h3
            id="monthly-business-close-title"
            className="mt-1 text-base font-black text-white sm:text-lg"
          >
            Cierre mensual · {monthLabel}
          </h3>
          <div className="mt-4 flex items-center gap-3">
            {isPositive ? (
              <TrendingUp className="h-7 w-7 text-emerald-400" />
            ) : isNegative ? (
              <TrendingDown className="h-7 w-7 text-red-400" />
            ) : (
              <Minus className="h-7 w-7 text-zinc-400" />
            )}
            <p
              className={cn(
                "font-mono text-4xl font-black tracking-tight sm:text-5xl",
                isPositive
                  ? "text-emerald-400"
                  : isNegative
                    ? "text-red-400"
                    : "text-zinc-200",
              )}
            >
              {signedCurrency(netResult)}
            </p>
          </div>
          <p className="mt-3 text-xs text-zinc-400">
            Ingresos − pauta − compromisos fijos − otros gastos del periodo
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider",
                financialStatusTone,
              )}
            >
              {financialStatusLabel}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider",
                confidenceUI.tone,
              )}
            >
              <ConfidenceIcon className="h-3.5 w-3.5" />
              {confidenceUI.label}
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-zinc-500">
            {confidenceDetail}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-white/[0.06] bg-black/25 p-3">
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Ingresos
            </p>
            <p className="mt-1 font-mono text-base font-black text-emerald-400">
              +{formatCurrency(revenue)}
            </p>
          </div>
          <div className="rounded-xl border border-red-500/10 bg-red-500/[0.04] p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Pauta
            </p>
            <p className="mt-1 font-mono text-base font-black text-red-400">
              -{formatCurrency(adSpend)}
            </p>
          </div>
          <div className="rounded-xl border border-violet-500/10 bg-violet-500/[0.04] p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Compromisos fijos
            </p>
            <p className="mt-1 font-mono text-base font-black text-violet-400">
              -{formatCurrency(fixedExpenses)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.04] p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Otros del periodo
            </p>
            <p className="mt-1 font-mono text-base font-black text-amber-400">
              -{formatCurrency(otherOperatingExpenses)}
            </p>
          </div>
          <p className="col-span-2 border-t border-white/[0.06] px-1 pt-2 text-center font-mono text-[10px] text-zinc-500">
            {formatCurrency(revenue)} − {formatCurrency(adSpend)} − {formatCurrency(fixedExpenses)} − {formatCurrency(otherOperatingExpenses)} = {signedCurrency(netResult)}
          </p>
        </div>
      </div>
    </section>
  );
}
