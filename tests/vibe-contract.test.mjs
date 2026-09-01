import assert from "node:assert/strict";
import test from "node:test";

import { vibeBusinessSummarySchema } from "../src/contracts/vibe-business.ts";

function fixture() {
  return {
    schemaVersion: "vibe-business-summary/v1",
    sourceSystem: "vibe-marketing",
    sourceGeneratedAt: "2026-08-31T20:35:00-06:00",
    timezone: "America/Mexico_City",
    currency: "MXN",
    status: "PROVISIONAL",
    period: {
      month: "2026-08",
      start: "2026-08-01",
      end: "2026-08-31",
      grain: "MONTH",
    },
    summary: {
      spendNet: 519.45,
      vatAmount: 83.11,
      spendGross: 602.56,
      whatsappSpendGross: 602.56,
      whatsappDailyBudget: 600,
      conversations: 32,
      costPerConversation: 18.83,
      sales: 4,
      revenueReconciled: 430,
      averageTicket: 107.5,
      advertisingBalance: -172.56,
      cpa: 150.64,
      roas: 0.7136,
    },
    products: [
      {
        productId: "mi-ciclo-listo:whatsapp",
        name: "Mi Ciclo Listo",
        track: "WHATSAPP",
        accountCount: 1,
        campaignCount: 1,
        spendNet: 519.45,
        vatAmount: 83.11,
        spendGross: 602.56,
        conversations: 32,
        costPerConversation: 18.83,
        sales: 4,
        revenueReconciled: 430,
        advertisingBalance: -172.56,
        cpa: 150.64,
        roas: 0.7136,
        validationGate: {
          ruleVersion: "track-b-2026-08-31",
          label: "30 conversaciones o $700 c/IVA",
          conversationsTarget: 30,
          spendGrossTarget: 700,
          reached: true,
          progress: 1,
        },
      },
    ],
    quality: {
      sources: [
        { id: "meta", label: "Meta Ads", status: "connected", rows: 1 },
        { id: "clicchat", label: "Ventas WhatsApp", status: "connected", rows: 4 },
        { id: "platform", label: "Ventas Landing", status: "not_configured", rows: 0 },
      ],
      checks: [{ code: "CHECK_1", label: "Mes calendario", status: "PASS" }],
      warnings: ["PLATFORM_UNAVAILABLE"],
      quarantinedSalesWithoutDate: 0,
      unattributedSales: 0,
      unclassifiedSpend: 0,
      excludedTestOrders: 0,
    },
  };
}

test("acepta el corte congelado de Mi Ciclo Listo", () => {
  const parsed = vibeBusinessSummarySchema.parse(fixture());
  assert.equal(parsed.summary.spendGross, 602.56);
  assert.equal(parsed.summary.conversations, 32);
  assert.equal(parsed.summary.sales, 4);
  assert.equal(parsed.summary.revenueReconciled, 430);
  assert.equal(parsed.products[0].track, "WHATSAPP");
});

test("rechaza totales que no coinciden y campos de PII", () => {
  const mismatched = fixture();
  mismatched.summary.sales = 5;
  assert.equal(vibeBusinessSummarySchema.safeParse(mismatched).success, false);

  const withPii = fixture();
  withPii.phone = "5215512345678";
  assert.equal(vibeBusinessSummarySchema.safeParse(withPii).success, false);
});

test("rechaza diferencias de gasto neto, IVA y bruto", () => {
  const netMismatch = fixture();
  netMismatch.summary.spendNet = 500;
  assert.equal(vibeBusinessSummarySchema.safeParse(netMismatch).success, false);

  const vatMismatch = fixture();
  vatMismatch.summary.vatAmount = 80;
  assert.equal(vibeBusinessSummarySchema.safeParse(vatMismatch).success, false);

  const grossMismatch = fixture();
  grossMismatch.summary.spendGross = 600;
  grossMismatch.products[0].spendGross = 600;
  assert.equal(vibeBusinessSummarySchema.safeParse(grossMismatch).success, false);
});

test("valida fechas reales y exige el mes calendario completo para FINAL", () => {
  const invalidDate = fixture();
  invalidDate.period.end = "2026-08-32";
  assert.equal(vibeBusinessSummarySchema.safeParse(invalidDate).success, false);

  const partialFinal = fixture();
  partialFinal.status = "FINAL";
  partialFinal.period.start = "2026-08-15";
  assert.equal(vibeBusinessSummarySchema.safeParse(partialFinal).success, false);

  const completeFinal = fixture();
  completeFinal.status = "FINAL";
  assert.equal(vibeBusinessSummarySchema.safeParse(completeFinal).success, true);
});

test("rechaza productos y checks duplicados", () => {
  const duplicatedProduct = fixture();
  duplicatedProduct.products.push({ ...duplicatedProduct.products[0] });
  duplicatedProduct.summary.spendNet *= 2;
  duplicatedProduct.summary.vatAmount *= 2;
  duplicatedProduct.summary.spendGross *= 2;
  duplicatedProduct.summary.conversations *= 2;
  duplicatedProduct.summary.sales *= 2;
  duplicatedProduct.summary.revenueReconciled *= 2;
  assert.equal(
    vibeBusinessSummarySchema.safeParse(duplicatedProduct).success,
    false,
  );

  const duplicatedCheck = fixture();
  duplicatedCheck.quality.checks.push({
    ...duplicatedCheck.quality.checks[0],
  });
  assert.equal(
    vibeBusinessSummarySchema.safeParse(duplicatedCheck).success,
    false,
  );
});
