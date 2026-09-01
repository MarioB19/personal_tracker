import { z } from "zod";

export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Usa un mes válido YYYY-MM");

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "La fecha no existe");

const moneySchema = z
  .number()
  .finite()
  .positive()
  .max(100_000_000)
  .refine((value) => {
    const cents = value * 100;
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(cents)) * 4;
    return Math.abs(cents - Math.round(cents)) <= tolerance;
  }, "Usa máximo dos decimales");

// Historical UI versions allowed zero/negative values. Reads stay tolerant so
// one legacy row cannot block recurrence repair; public totals clamp expenses
// to zero while every new write still uses the strictly positive schema above.
const storedMoneySchema = z
  .number()
  .finite();

const timestampLikeSchema = z.custom<
  Date | { toDate: () => Date }
>((value) => {
  if (value instanceof Date) return true;
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  );
}, "Se esperaba una fecha de Firestore");

export const expenseCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    amount: moneySchema,
    category: z
      .enum([
        "VIVIENDA",
        "TRANSPORTE",
        "COMIDA",
        "ENTRETENIMIENTO",
        "SALUD",
        "EDUCACION",
        "SERVICIOS",
        "SUSCRIPCIONES",
        "OTRO",
      ])
      .default("OTRO"),
    type: z.enum(["FIJO", "VARIABLE", "SUSCRIPCION"]).default("VARIABLE"),
    frequency: z
      .enum(["MENSUAL", "QUINCENAL", "SEMANAL", "ANUAL", "UNICO"])
      .default("UNICO"),
    chargeDay: z.number().int().min(1).max(31).optional(),
    date: dateSchema,
    financialContext: z.enum(["PERSONAL", "BUSINESS"]).default("PERSONAL"),
    productId: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(
        /^[^\u0000-\u001F\u007F]+$/,
        "productId no puede contener caracteres de control",
      )
      .optional(),
    productName: z.string().trim().min(1).max(120).optional(),
    subscriptionStatus: z.enum(["active", "cancelled"]).optional(),
    isNecessity: z.boolean().default(false),
    notes: z.string().trim().max(1_000).default(""),
    externalRef: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(
        /^[^\u0000-\u001F\u007F]+$/,
        "externalRef no puede contener caracteres de control",
      )
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === "SUSCRIPCION" && value.frequency === "UNICO") {
      context.addIssue({
        code: "custom",
        path: ["frequency"],
        message: "Una suscripción debe tener una frecuencia recurrente",
      });
    }

    if (value.type !== "SUSCRIPCION" && value.subscriptionStatus) {
      context.addIssue({
        code: "custom",
        path: ["subscriptionStatus"],
        message: "subscriptionStatus solo aplica a suscripciones",
      });
    }

    if ((value.productId || value.productName) && value.financialContext !== "BUSINESS") {
      context.addIssue({
        code: "custom",
        path: ["financialContext"],
        message: "Los productos solo pueden asociarse a gastos de negocio",
      });
    }
  });

export const expenseSeriesIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .regex(
    /^[^\u0000-\u001F\u007F]+$/,
    "seriesId no puede contener caracteres de control",
  );

const expenseSeriesUpdateSchema = z
  .object({
    action: z.literal("UPDATE"),
    seriesId: expenseSeriesIdSchema,
    effectiveFrom: monthSchema,
    expectedRevision: z.number().int().nonnegative(),
    expense: expenseCreateSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.expense.type !== "FIJO" &&
        value.expense.type !== "SUSCRIPCION") ||
      value.expense.frequency !== "MENSUAL"
    ) {
      context.addIssue({
        code: "custom",
        path: ["expense", "frequency"],
        message:
          "Solo los gastos fijos y suscripciones mensuales se pueden versionar como serie",
      });
    }

    if (value.expense.date.slice(0, 7) !== value.effectiveFrom) {
      context.addIssue({
        code: "custom",
        path: ["expense", "date"],
        message: "La fecha debe pertenecer al mes effectiveFrom",
      });
    }
  });

const expenseSeriesStopSchema = z
  .object({
    action: z.literal("STOP"),
    seriesId: expenseSeriesIdSchema,
    effectiveFrom: monthSchema,
    expectedRevision: z.number().int().nonnegative(),
    notes: z.string().trim().max(1_000).default(""),
  })
  .strict();

/**
 * A recurring expense is immutable once written. Mutations append a version
 * that becomes effective in a month, while expectedRevision prevents a stale
 * client from silently overwriting a newer decision.
 */
export const expenseSeriesMutationSchema = z.union([
  expenseSeriesUpdateSchema,
  expenseSeriesStopSchema,
]);

export const expenseListQuerySchema = z.object({
  month: monthSchema.optional(),
  financialContext: z.enum(["PERSONAL", "BUSINESS"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const expenseApiRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string(),
  category: z.enum([
    "VIVIENDA",
    "TRANSPORTE",
    "COMIDA",
    "ENTRETENIMIENTO",
    "SALUD",
    "EDUCACION",
    "SERVICIOS",
    "SUSCRIPCIONES",
    "OTRO",
  ]),
  amount: storedMoneySchema,
  type: z.enum(["FIJO", "VARIABLE", "SUSCRIPCION"]),
  frequency: z.enum(["MENSUAL", "QUINCENAL", "SEMANAL", "ANUAL", "UNICO"]),
  effectiveFrom: monthSchema.optional(),
  seriesId: z.string().min(1).max(240).optional(),
  recurrenceStatus: z.enum(["ACTIVE", "CANCELLED"]).optional(),
  revision: z.number().int().nonnegative().optional(),
  chargeDay: z.number().finite().optional(),
  month: monthSchema,
  date: dateSchema.optional(),
  isNecessity: z.boolean(),
  financialContext: z.enum(["PERSONAL", "BUSINESS"]).optional(),
  productId: z.string().optional(),
  productName: z.string().optional(),
  subscriptionStatus: z.enum(["active", "cancelled"]).optional(),
  externalRef: z.string().optional(),
  createdBy: z.string().optional(),
  notes: z.string(),
  createdAt: timestampLikeSchema.optional(),
  updatedAt: timestampLikeSchema.optional(),
});

export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
export type ExpenseApiRecord = z.infer<typeof expenseApiRecordSchema>;
export type ExpenseSeriesMutationInput = z.infer<
  typeof expenseSeriesMutationSchema
>;

export function expenseRecurrenceStatus(expense: {
  type: "FIJO" | "VARIABLE" | "SUSCRIPCION";
  subscriptionStatus?: "active" | "cancelled";
}) {
  return expense.type === "SUSCRIPCION" &&
    expense.subscriptionStatus === "cancelled"
    ? ("CANCELLED" as const)
    : ("ACTIVE" as const);
}

/**
 * Keeps API revisions compatible with UI versions that use Date.now().
 * The result always advances the observed revision, even if the local clock
 * has not advanced yet.
 */
export function nextExpenseSeriesRevision(
  currentRevision: number,
  nowMillis: number,
) {
  const current =
    Number.isSafeInteger(currentRevision) && currentRevision >= 0
      ? currentRevision
      : 0;
  const clock =
    Number.isSafeInteger(nowMillis) && nowMillis >= 0 ? nowMillis : 0;
  return Math.max(current + 1, clock);
}

export function normalizeExpenseInput(input: ExpenseCreateInput) {
  return {
    ...input,
    month: input.date.slice(0, 7),
    subscriptionStatus:
      input.type === "SUSCRIPCION"
        ? (input.subscriptionStatus ?? "active")
        : undefined,
  };
}

export type NormalizedExpenseInput = ReturnType<typeof normalizeExpenseInput>;
