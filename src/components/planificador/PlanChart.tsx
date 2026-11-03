"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PlanMonth } from "@/lib/planning/savings-plan";
import { formatCurrency } from "@/lib/utils";
import { MONTH_LABELS } from "@/components/planificador/constants";

function compact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

/** Barras = dinero libre del mes; línea = dinero total acumulado. */
export function PlanChart({ months, visibleMonths }: { months: PlanMonth[]; visibleMonths: number[] }) {
  const data = visibleMonths.map((index) => {
    const month = months[index];
    return {
      label: MONTH_LABELS[index],
      free: month.free,
      accumulated: month.accumulated,
      reserved: month.reservedAccumulated,
    };
  });

  return (
    <div className="h-64 w-full" role="img" aria-label="Dinero libre por mes y dinero total acumulado">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 256 }}>
        <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="free"
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={compact}
            width={44}
          />
          <YAxis
            yAxisId="total"
            orientation="right"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={compact}
            width={48}
          />
          <ReferenceLine yAxisId="free" y={0} stroke="rgba(255,255,255,0.18)" />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{
              background: "#0b0b0d",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e4e4e7", fontWeight: 700 }}
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === "free" ? "Libre del mes" : name === "accumulated" ? "Dinero total" : "Apartado acumulado",
            ]}
          />
          <Bar yAxisId="free" dataKey="free" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.free >= 0 ? "#34d399" : "#fb7185"} fillOpacity={0.75} />
            ))}
          </Bar>
          <Line
            yAxisId="total"
            type="monotone"
            dataKey="accumulated"
            stroke="#f59e0b"
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={{ r: 3, fill: "#0b0b0d", stroke: "#f59e0b", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="total"
            type="monotone"
            dataKey="reserved"
            stroke="#38bdf8"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            isAnimationActive={false}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
