import { z } from "zod";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableNonNegative = z.number().nonnegative().nullable();

const validationGateSchema = z
  .object({
    ruleVersion: z.literal("track-b-2026-08-31"),
    label: z.literal("30 conversaciones o $700 c/IVA"),
    conversationsTarget: z.literal(30),
    spendGrossTarget: z.literal(700),
    reached: z.boolean(),
    progress: z.number().min(0).max(1),
  })
  .strict();

export const vibeBusinessProductSchema = z
  .object({
    productId: z.string().min(1).max(160),
    name: z.string().min(1).max(180),
    track: z.enum(["WHATSAPP", "LANDING", "UNCLASSIFIED"]),
    accountCount: z.number().int().nonnegative(),
    campaignCount: z.number().int().nonnegative(),
    spendNet: z.number().nonnegative(),
    vatAmount: z.number().nonnegative(),
    spendGross: z.number().nonnegative(),
    conversations: z.number().int().nonnegative(),
    costPerConversation: nullableNonNegative,
    sales: z.number().int().nonnegative(),
    revenueReconciled: z.number().nonnegative(),
    advertisingBalance: z.number(),
    cpa: nullableNonNegative,
    roas: nullableNonNegative,
    validationGate: validationGateSchema.nullable(),
  })
  .strict()
  .superRefine((product, ctx) => {
    if (Math.abs(product.spendGross - product.spendNet - product.vatAmount) > 0.02) {
      ctx.addIssue({
        code: "custom",
        message: "El gasto bruto no coincide con gasto neto + IVA",
        path: ["spendGross"],
      });
    }
  });

export const vibeBusinessSummarySchema = z
  .object({
    schemaVersion: z.literal("vibe-business-summary/v1"),
    sourceSystem: z.literal("vibe-marketing"),
    sourceGeneratedAt: z.string().datetime({ offset: true }),
    timezone: z.literal("America/Mexico_City"),
    currency: z.literal("MXN"),
    status: z.enum(["PROVISIONAL", "FINAL"]),
    period: z
      .object({
        month: monthSchema,
        start: dateSchema,
        end: dateSchema,
        grain: z.literal("MONTH"),
      })
      .strict(),
    summary: z
      .object({
        spendNet: z.number().nonnegative(),
        vatAmount: z.number().nonnegative(),
        spendGross: z.number().nonnegative(),
        whatsappSpendGross: z.number().nonnegative(),
        whatsappDailyBudget: z.number().nonnegative(),
        conversations: z.number().int().nonnegative(),
        costPerConversation: nullableNonNegative,
        sales: z.number().int().nonnegative(),
        revenueReconciled: z.number().nonnegative(),
        averageTicket: nullableNonNegative,
        advertisingBalance: z.number(),
        cpa: nullableNonNegative,
        roas: nullableNonNegative,
      })
      .strict(),
    products: z.array(vibeBusinessProductSchema).max(500),
    quality: z
      .object({
        sources: z.array(
          z
            .object({
              id: z.enum(["meta", "clicchat", "platform"]),
              label: z.string().min(1).max(100),
              status: z.enum([
                "connected",
                "partial",
                "empty",
                "error",
                "not_configured",
              ]),
              rows: z.number().int().nonnegative(),
            })
            .strict(),
        ),
        checks: z.array(
          z
            .object({
              code: z.string().regex(/^CHECK_\d+$/),
              label: z.string().min(1).max(180),
              status: z.enum(["PASS", "WARNING", "ERROR"]),
            })
            .strict(),
        ),
        warnings: z.array(z.string().regex(/^[A-Z0-9_]+$/)).max(100),
        quarantinedSalesWithoutDate: z.number().int().nonnegative(),
        unattributedSales: z.number().int().nonnegative(),
        unclassifiedSpend: z.number().nonnegative(),
        excludedTestOrders: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (
      !payload.period.start.startsWith(`${payload.period.month}-`) ||
      !payload.period.end.startsWith(`${payload.period.month}-`)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "El rango no corresponde al mes declarado",
        path: ["period"],
      });
    }

    const totals = payload.products.reduce(
      (sum, product) => ({
        spendNet: sum.spendNet + product.spendNet,
        vatAmount: sum.vatAmount + product.vatAmount,
        spendGross: sum.spendGross + product.spendGross,
        conversations: sum.conversations + product.conversations,
        sales: sum.sales + product.sales,
        revenue: sum.revenue + product.revenueReconciled,
      }),
      {
        spendNet: 0,
        vatAmount: 0,
        spendGross: 0,
        conversations: 0,
        sales: 0,
        revenue: 0,
      },
    );

    const mismatches = [
      ["spendNet", totals.spendNet, payload.summary.spendNet],
      ["vatAmount", totals.vatAmount, payload.summary.vatAmount],
      ["spendGross", totals.spendGross, payload.summary.spendGross],
      ["conversations", totals.conversations, payload.summary.conversations],
      ["sales", totals.sales, payload.summary.sales],
      ["revenueReconciled", totals.revenue, payload.summary.revenueReconciled],
    ] as const;

    for (const [field, fromProducts, fromSummary] of mismatches) {
      if (Math.abs(fromProducts - fromSummary) > 0.02) {
        ctx.addIssue({
          code: "custom",
          message: `El total ${field} no coincide con el desglose por producto`,
          path: ["summary", field],
        });
      }
    }

    if (
      Math.abs(
        payload.summary.spendGross -
          payload.summary.spendNet -
          payload.summary.vatAmount,
      ) > 0.02
    ) {
      ctx.addIssue({
        code: "custom",
        message: "El gasto bruto total no coincide con gasto neto + IVA",
        path: ["summary", "spendGross"],
      });
    }
  });

export type VibeBusinessSummary = z.infer<typeof vibeBusinessSummarySchema>;
export type VibeBusinessProduct = z.infer<typeof vibeBusinessProductSchema>;
