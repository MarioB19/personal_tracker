import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyPrecise(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function getProgressColor(progress: number): string {
  if (progress >= 75) return "text-emerald-400";
  if (progress >= 50) return "text-amber-400";
  if (progress >= 25) return "text-orange-400";
  return "text-red-400";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    COMPLETED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    IN_PROGRESS: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    AT_RISK: "bg-red-500/20 text-red-400 border-red-500/30",
    PENDING: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    OVERDUE: "bg-red-500/20 text-red-400 border-red-500/30",
    PAUSED: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    CANCELLED: "bg-zinc-700/20 text-zinc-500 border-zinc-700/30",
    DRAFT: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
    FAILED: "bg-red-500/20 text-red-400 border-red-500/30",
    PAID: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    REACHED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };
  return colors[status] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
}

/**
 * Normaliza y homologa títulos de actividades para que variaciones
 * de nombres (ej: "Descansar" vs "Descanso", "Daskalos + Red" vs "Daskalos", etc.)
 * se agrupen y contabilicen limpiamente en métricas y analíticas.
 */
export function normalizeActivityName(title: string): string {
  if (!title) return "Sin Especificar";
  const trimmed = title.trim();

  // 1. Dormir
  if (/^dormir$/i.test(trimmed)) return "Dormir";

  // 2. Astra
  if (/^astra$/i.test(trimmed)) return "Astra";

  // 3. Deep Work (Emprender)
  if (/deep work/i.test(trimmed)) return "Deep Work (Emprender)";

  // 4. Descanso / Libre
  if (/^(descansar|descanso|libre)$/i.test(trimmed) || /descansar \+ journaling \+ leer/i.test(trimmed)) return "Descanso";

  // 5. Daskalos & Redes
  if (/daskalos/i.test(trimmed) || /^red$/i.test(trimmed)) return "Daskalos / Red";

  // 6. Gym
  if (/^gym$/i.test(trimmed)) return "Gym";

  // 7. Running / Correr
  if (/^(running|correr)$/i.test(trimmed)) return "Running";

  // 8. Aprendizaje y Hábitos (Agrupa: Leer, Journaling, Acomodar + Leer, Tarea, Inglés, Aprendizaje técnico, Misa)
  if (/^(acomodar \+ leer|leer|journaling|aprendizaje t[eé]cnico|tarea|ingl[eé]s|misa|acomodar)$/i.test(trimmed)) {
    return "Aprendizaje y Hábitos";
  }

  // Retornar título original si no coincide con ningún alias conocido
  return trimmed;
}
