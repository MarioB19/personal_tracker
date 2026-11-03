"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthProgress } from "@/lib/planning/savings-plan";
import { formatCurrency } from "@/lib/utils";
import { MONTH_LABELS } from "@/components/planificador/constants";

function compact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

const NAMES: Record<string, string> = {
  plan: "Ahorro planeado",
  real: "Ahorro real",
  planAccumulated: "Acumulado planeado",
  realAccumulated: "Acumulado real",
};

/** Barras: ahorro del mes (plan vs real). Líneas: acumulado (plan vs real). */
export function ProgressChart({ progress }: { progress: MonthProgress[] }) {
  const data = progress.map((item) => ({
    label: MONTH_LABELS[item.month],
    plan: item.plan,
    real: item.real,
    planAccumulated: item.planAccumulated,
    realAccumulated: item.realAccumulated,
  }));

  return (
    <div className="h-72 w-full" role="img" aria-label="Ahorro planeado contra ahorro real por mes y acumulado">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 288 }}>
        <ComposedChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={6} />
          <YAxis yAxisId="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={compact} width={40} />
          <YAxis yAxisId="total" orientation="right" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={compact} width={44} />
          <ReferenceLine yAxisId="month" y={0} stroke="rgba(255,255,255,0.18)" />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{ background: "#0b0b0d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "#e4e4e7", fontWeight: 700 }}
            formatter={(value, name) => [value === null || value === undefined ? "—" : formatCurrency(Number(value)), NAMES[String(name)] ?? String(name)]}
          />
          <Bar yAxisId="month" dataKey="plan" fill="#52525b" radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
          <Bar yAxisId="month" dataKey="real" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
          <Line yAxisId="total" type="monotone" dataKey="planAccumulated" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          <Line yAxisId="total" type="monotone" dataKey="realAccumulated" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3, fill: "#0b0b0d", stroke: "#38bdf8", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
