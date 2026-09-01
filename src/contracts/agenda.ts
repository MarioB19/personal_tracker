import { z } from "zod";

export const AGENDA_TIME_ZONE = "America/Mexico_City" as const;

export const agendaDaySchema = z.enum([
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
]);

export const agendaCategorySchema = z.enum([
  "TRABAJO",
  "APRENDIZAJE",
  "SALUD",
  "PERSONAL",
  "OCIO",
]);

export const agendaSlotIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(
    /^[a-z0-9][a-z0-9_-]*$/,
    "Usa un ID estable en minúsculas con letras ASCII, números, guion o guion bajo",
  );

export const agendaStartTimeSchema = z
  .string()
  .regex(
    /^(?:[01]\d|2[0-3]):[0-5]\d$/,
    "Usa una hora de inicio válida HH:mm entre 00:00 y 23:59",
  );

export const agendaEndTimeSchema = z
  .string()
  .regex(
    /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/,
    "Usa una hora de término válida HH:mm; 24:00 solo se admite como término",
  );

export const isoWeekSchema = z
  .string()
  .regex(/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/, "Usa una semana ISO YYYY-Www")
  .refine(isValidIsoWeek, "La semana ISO no existe en ese año");

export const weeklyTemplateSlotSchema = z
  .object({
    id: agendaSlotIdSchema,
    day: agendaDaySchema,
    startTime: agendaStartTimeSchema,
    endTime: agendaEndTimeSchema,
    title: z.string().trim().min(1).max(120),
    category: agendaCategorySchema,
    activityId: z.string().trim().min(1).max(120).optional(),
    projectTag: z.string().trim().min(1).max(120).optional(),
    notes: z.string().trim().max(500).default(""),
  })
  .strict();

const scheduleShape = {
  timezone: z.literal(AGENDA_TIME_ZONE).default(AGENDA_TIME_ZONE),
  slots: z.array(weeklyTemplateSlotSchema).min(1).max(168),
};

export const weeklyTemplatePreviewSchema = withScheduleValidation(
  z.object(scheduleShape).strict(),
);

export const weeklyTemplateReplaceSchema = withScheduleValidation(
  z
    .object({
      ...scheduleShape,
      expectedRevision: z.number().int().min(0),
    })
    .strict(),
);

export const agendaWeekApplySchema = z
  .object({
    weekId: isoWeekSchema,
    mode: z.literal("replace"),
    dryRun: z.boolean().default(true),
    expectedTemplateRevision: z.number().int().min(0),
    expectedWeekRevision: z.number().int().min(0).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.dryRun && value.expectedWeekRevision === undefined) {
      context.addIssue({
        code: "custom",
        path: ["expectedWeekRevision"],
        message: "expectedWeekRevision es obligatorio al aplicar cambios",
      });
    }
  });

export type AgendaDay = z.infer<typeof agendaDaySchema>;
export type AgendaCategory = z.infer<typeof agendaCategorySchema>;
export type WeeklyTemplateSlot = z.infer<typeof weeklyTemplateSlotSchema>;
export type WeeklyTemplatePreviewInput = z.infer<
  typeof weeklyTemplatePreviewSchema
>;
export type WeeklyTemplateReplaceInput = z.infer<
  typeof weeklyTemplateReplaceSchema
>;
export type AgendaWeekApplyInput = z.infer<typeof agendaWeekApplySchema>;

const DAY_ORDER: Record<AgendaDay, number> = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUN: 7,
};

function withScheduleValidation<
  T extends z.ZodType<{
    timezone: typeof AGENDA_TIME_ZONE;
    slots: WeeklyTemplateSlot[];
  }>,
>(schema: T) {
  return schema.superRefine((value, context) => {
    const seenIds = new Map<string, number>();

    value.slots.forEach((slot, index) => {
      const previousIndex = seenIds.get(slot.id);
      if (previousIndex !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["slots", index, "id"],
          message: `El ID también se usa en slots.${previousIndex}.id`,
        });
      } else {
        seenIds.set(slot.id, index);
      }

      if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) {
        context.addIssue({
          code: "custom",
          path: ["slots", index, "endTime"],
          message: "La hora de término debe ser posterior a la de inicio",
        });
      }
    });

    for (const day of agendaDaySchema.options) {
      const daySlots = value.slots
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot }) => slot.day === day)
        .sort(
          (a, b) =>
            timeToMinutes(a.slot.startTime) -
              timeToMinutes(b.slot.startTime) ||
            timeToMinutes(a.slot.endTime) - timeToMinutes(b.slot.endTime),
        );

      let furthestEnding = daySlots[0];
      for (let index = 1; index < daySlots.length; index += 1) {
        const current = daySlots[index];
        if (
          timeToMinutes(current.slot.startTime) <
          timeToMinutes(furthestEnding.slot.endTime)
        ) {
          context.addIssue({
            code: "custom",
            path: ["slots", current.index, "startTime"],
            message: `Se traslapa con el bloque ${furthestEnding.slot.id}`,
          });
        }
        if (
          timeToMinutes(current.slot.endTime) >
          timeToMinutes(furthestEnding.slot.endTime)
        ) {
          furthestEnding = current;
        }
      }
    }
  });
}

export function timeToMinutes(value: string) {
  if (value === "24:00") return 24 * 60;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function normalizeTemplateSlots(slots: WeeklyTemplateSlot[]) {
  return [...slots].sort(
    (a, b) =>
      DAY_ORDER[a.day] - DAY_ORDER[b.day] ||
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
      timeToMinutes(a.endTime) - timeToMinutes(b.endTime) ||
      a.id.localeCompare(b.id),
  );
}

export function summarizeWeeklyTemplate(slots: WeeklyTemplateSlot[]) {
  const minutesByDay = Object.fromEntries(
    agendaDaySchema.options.map((day) => [day, 0]),
  ) as Record<AgendaDay, number>;
  const minutesByCategory = Object.fromEntries(
    agendaCategorySchema.options.map((category) => [category, 0]),
  ) as Record<AgendaCategory, number>;

  for (const slot of slots) {
    const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
    minutesByDay[slot.day] += duration;
    minutesByCategory[slot.category] += duration;
  }

  const totalMinutes = Object.values(minutesByDay).reduce(
    (total, minutes) => total + minutes,
    0,
  );
  const weeklyMinutes = 7 * 24 * 60;
  const unallocatedMinutes = weeklyMinutes - totalMinutes;
  const warnings: string[] = [];

  // The tracker can intentionally account for the complete day, including
  // sleep, meals and free time. Only warn about excessive work, not coverage.
  if (minutesByCategory.TRABAJO > 60 * 60) {
    warnings.push(
      "La plantilla programa más de 60 horas semanales de trabajo",
    );
  }

  return {
    slotCount: slots.length,
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
    unallocatedMinutes,
    coveragePercent: Number(((totalMinutes / weeklyMinutes) * 100).toFixed(1)),
    minutesByDay,
    minutesByCategory,
    warnings,
  };
}

function isValidIsoWeek(value: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const week = Number(match[2]);
  const december28 = new Date(Date.UTC(year, 11, 28));
  return week <= isoWeekNumber(december28);
}

function isoWeekNumber(date: Date) {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
}
