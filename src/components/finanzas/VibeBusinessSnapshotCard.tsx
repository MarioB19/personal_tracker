"use client";

import type { VibeBusinessSummary } from "@/contracts/vibe-business";
import { analyzeVibeBusinessSummaryQuality } from "@/lib/finance/business-metrics";
import { cn, formatCurrencyPrecise } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type Props = {
  summary: VibeBusinessSummary | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  isCurrentMonth: boolean;
};

function sourceLabel(status: VibeBusinessSummary["quality"]["sources"][number]["status"]) {
  if (status === "connected") return "Conectada";
  if (status === "partial") return "Parcial";
  if (status === "empty") return "Sin datos";
  if (status === "not_configured") return "No configurada";
  return "Con error";
}
function sourceTone(status: VibeBusinessSummary["quality"]["sources"][number]["status"]) {
  if (status === "connected") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
  if (status === "empty") return "border-blue-500/20 bg-blue-500/10 text-blue-400";
  return "border-amber-500/20 bg-amber-500/10 text-amber-400";
}

export default function VibeBusinessSnapshotCard({
  summary,
  loading,
  error,
  onRetry,
  isCurrentMonth,
}: Props) {
  if (!summary && loading) {
    return (
      <div className="glass-card rounded-3xl border border-amber-500/15 bg-[#0c0c0e]/90 p-6 shadow-xl">
        <div className="flex items-center gap-3 text-amber-400">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-xs font-black uppercase tracking-wider">
            Sincronizando resumen de Vibe…
          </span>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="glass-card flex flex-col gap-4 rounded-3xl border border-amber-500/20 bg-amber-950/10 p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-amber-400">
              Vibe no disponible · usando registros manuales
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {error || "No fue posible consultar el resumen mensual."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-400 transition-colors hover:bg-amber-500/15"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reintentar
        </button>
      </div>
    );
  }

  const generatedAt = new Date(summary.sourceGeneratedAt).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const quality = analyzeVibeBusinessSummaryQuality(summary);
  const qualityLabel = quality.complete
    ? "Cierre confirmado"
    : isCurrentMonth && quality.usableEstimate
      ? "Mes abierto · estimación"
      : isCurrentMonth
        ? "Estimación incompleta"
        : "Cierre pendiente";
  const qualityTone = quality.complete
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
    : quality.usableEstimate && isCurrentMonth
      ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
      : "border-amber-500/20 bg-amber-500/10 text-amber-400";

  const blockingReasons = [
    ...(!isCurrentMonth && !quality.statusFinal
      ? ["Vibe aún no ha emitido el cierre final del mes."]
      : []),
    ...quality.sourceIssues.map((issue) => {
      if (issue.reason === "MISSING") return `${issue.label}: fuente ausente.`;
      if (issue.reason === "DUPLICATE") return `${issue.label}: fuente duplicada.`;
      return `${issue.label}: ${issue.status ? sourceLabel(issue.status).toLowerCase() : "no disponible"}.`;
    }),
    ...(quality.missingChecks.length > 0
      ? [`Faltan controles de cierre: ${quality.missingChecks.join(", ")}.`]
      : []),
    ...(quality.duplicateChecks.length > 0
      ? [`Hay controles duplicados: ${quality.duplicateChecks.join(", ")}.`]
      : []),
    ...(quality.unexpectedChecks.length > 0
      ? [`Hay controles no reconocidos: ${quality.unexpectedChecks.join(", ")}.`]
      : []),
    ...quality.errorChecks.map(
      (check) => `${check.code}: ${check.label}.`,
    ),
    ...quality.dataIssues.map((issue) =>
      issue.code === "UNCLASSIFIED_SPEND"
        ? `Hay ${formatCurrencyPrecise(issue.value)} de pauta sin clasificar.`
        : `${issue.value} venta${issue.value === 1 ? "" : "s"} quedó${issue.value === 1 ? "" : "aron"} en cuarentena por falta de fecha.`,
    ),
  ];
  const warningChecks = summary.quality.checks.filter(
    (check) => check.status === "WARNING",
  );

  return (
    <div className="glass-card overflow-hidden rounded-3xl border border-amber-500/20 bg-[#0c0c0e]/90 shadow-xl">
      <div className="flex flex-col gap-4 border-b border-white/[0.06] bg-gradient-to-r from-amber-500/[0.08] to-transparent px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
            <Cloud className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Resumen financiero de Vibe
              </h3>
              <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                Sincronizado · Solo lectura
              </span>
              <span
                className={cn(
                  "rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-wider",
                  qualityTone,
                )}
              >
                {qualityLabel}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Actualizado {generatedAt} · Vibe reemplaza los registros manuales de pauta y ventas para este mes.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-400 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-px bg-white/[0.04] md:grid-cols-4">
        <div className="bg-[#0c0c0e] p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Meta con IVA</p>
          <p className="mt-1 font-mono text-lg font-black text-red-400">
            {formatCurrencyPrecise(summary.summary.spendGross)}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">
            IVA {formatCurrencyPrecise(summary.summary.vatAmount)}
          </p>
        </div>
        <div className="bg-[#0c0c0e] p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Ingreso conciliado</p>
          <p className="mt-1 font-mono text-lg font-black text-emerald-400">
            {formatCurrencyPrecise(summary.summary.revenueReconciled)}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">{summary.summary.sales} venta(s)</p>
        </div>
        <div className="bg-[#0c0c0e] p-5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <MessageCircle className="h-3 w-3" /> Conversaciones
          </p>
          <p className="mt-1 font-mono text-lg font-black text-blue-400">
            {summary.summary.conversations}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">
            Costo {summary.summary.costPerConversation === null ? "—" : formatCurrencyPrecise(summary.summary.costPerConversation)}
          </p>
        </div>
        <div className="bg-[#0c0c0e] p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">ROAS · CPA</p>
          <p className="mt-1 font-mono text-lg font-black text-amber-400">
            {summary.summary.roas === null ? "—" : `${summary.summary.roas.toFixed(2)}x`}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">
            CPA {summary.summary.cpa === null ? "—" : formatCurrencyPrecise(summary.summary.cpa)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-white/[0.06] px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {summary.quality.sources.map((source) => (
            <span
              key={source.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
                sourceTone(source.status),
              )}
            >
              {source.status === "connected" ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <ShieldCheck className="h-3 w-3" />
              )}
              {source.label}: {sourceLabel(source.status)}
            </span>
          ))}
        </div>
        {quality.complete ? (
          <p className="text-[10px] font-semibold text-emerald-400">
            Fuentes completas · cierre elegible para runway
          </p>
        ) : isCurrentMonth && quality.usableEstimate ? (
          <p className="text-[10px] font-semibold text-blue-400">
            Corte utilizable para la proyección · se confirma al terminar el mes
          </p>
        ) : null}
      </div>

      {(blockingReasons.length > 0 || warningChecks.length > 0) && (
        <div className="border-t border-white/[0.06] bg-amber-500/[0.035] px-6 py-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                {blockingReasons.length > 0
                  ? "Qué falta para confirmar este cierre"
                  : "Observaciones del corte"}
              </p>
              <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-zinc-400">
                {blockingReasons.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
                {warningChecks.map((check) => (
                  <li key={`${check.code}:${check.label}`}>
                    • {check.label} (advertencia, no bloquea por sí sola).
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
