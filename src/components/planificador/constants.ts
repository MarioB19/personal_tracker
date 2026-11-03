import type { PlanExpenseGroup } from "@/lib/types";

export const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export const GROUP_META: Record<
  PlanExpenseGroup,
  { title: string; description: string; add: string; empty: string; accent: string }
> = {
  PERSONAL: {
    title: "Gastos personales",
    description: "Lo que cuesta tu vida cada mes",
    add: "Gasto personal",
    empty: "Sin gastos personales registrados.",
    accent: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  },
  BUSINESS: {
    title: "Operación del negocio",
    description: "Suscripciones, infraestructura y pauta",
    add: "Gasto del negocio",
    empty: "Sin gastos de operación registrados.",
    accent: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  },
  ONE_OFF: {
    title: "Gastos puntuales",
    description: "Compras, viajes, regalos e imprevistos",
    add: "Gasto puntual",
    empty: "Sin gastos puntuales.",
    accent: "border-orange-500/20 bg-orange-500/10 text-orange-300",
  },
  DEBT: {
    title: "Deudas y pagos a meses",
    description: "Tarjetas, MSI e impuestos",
    add: "Pago de deuda",
    empty: "Sin pagos de deuda.",
    accent: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  },
};
