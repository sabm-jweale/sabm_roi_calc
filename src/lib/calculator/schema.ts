import { z } from "zod";

import { CurrencyCode, ScenarioInputs } from "./types";

const currencyEnum = z.enum(["GBP", "USD", "EUR"] satisfies CurrencyCode[]);

// Helper to coerce input to number and apply min/max
const num = (min?: number, max?: number) => {
  let s = z.coerce.number();
  if (min !== undefined) s = s.min(min);
  if (max !== undefined) s = s.max(max);
  return s;
};

const percentage = (min: number, max: number) => z.coerce.number().min(min, { message: `Must be ≥ ${min}%.` }).max(max, { message: `Must be ≤ ${max}%.` });

const capacitySourceEnum = z.enum(["budget", "team"]);

export const programmeSchema = z
  .object({
    durationMonths: num(0, 24),
    rampMonths: num(0, 24),
    currency: currencyEnum,
    numberFormatLocale: z.string().min(2),
  })
  .refine((value) => value.rampMonths <= value.durationMonths, {
    path: ["rampMonths"],
    message: "Ramp-up must be less than or equal to duration.",
  });

export const marketSchema = z
  .object({
    targetAccounts: num(0, 2000),
    inMarketRate: percentage(0, 70),
    qualifiedOppsPerAccount: num(0, 3),
    baselineWinRate: percentage(0, 60),
    baselineAcv: num(0),
    contributionMargin: percentage(0, 95),
    salesCycleMonthsBaseline: num(0, 24),
    salesCycleMonthsAbm: num(0, 24),
  })
  .refine((value) => value.salesCycleMonthsAbm <= value.salesCycleMonthsBaseline, {
    path: ["salesCycleMonthsAbm"],
    message: "ABM cycle must be <= baseline cycle.",
  });

export const upliftSchema = z.object({
  winRateUplift: percentage(0, 20),
  acvUplift: percentage(-30, 100),
  opportunityRateUplift: percentage(0, 100),
});

export const costsSchema = z
  .object({
    people: num(0),
    media: num(0),
    dataTech: num(0),
    content: num(0),
    agency: num(0),
    other: num(0),
    totalOverride: num(0).optional(),
  })
  .refine((value) => {
    const override = value.totalOverride ?? 0;
    if (override > 0) {
      return true;
    }

    return (
      value.people > 0 ||
      value.media > 0 ||
      value.dataTech > 0 ||
      value.content > 0 ||
      value.agency > 0 ||
      value.other > 0
    );
  }, {
    message: "Provide a total investment or populate at least one cost category.",
  });

export const capacitySchema = z
  .object({
    source: capacitySourceEnum,
    marketingFte: num(0, 500),
    salesFte: num(0, 500),
    marketingUtilisation: percentage(0, 100),
    salesUtilisation: percentage(0, 100),
    hoursPerAccount: num(1, 200),
    budgetCapacityAccounts: z.number().min(0).max(5000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.source === "team") {
      if (value.marketingFte <= 0 && value.salesFte <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["marketingFte"],
          message: "Set at least one FTE to use team time.",
        });
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["salesFte"],
          message: "Set at least one FTE to use team time.",
        });
      }
    }
  });

export const alignmentSchema = z.object({
  level: z.enum(["poor", "standard", "excellent"]),
});

export const sensitivitySchema = z.object({
  inMarketRange: z.array(z.number().min(0).max(100)).nonempty(),
  winRateUpliftRange: z.array(z.number().min(0).max(100)).nonempty(),
  resolution: z.number().min(3).max(11).optional(),
});

export const scenarioSchema = z.object({
  programme: programmeSchema,
  market: marketSchema,
  uplifts: upliftSchema,
  costs: costsSchema,
  capacity: capacitySchema,
  alignment: alignmentSchema,
  sensitivity: sensitivitySchema,
});

export type ScenarioInputSchema = z.infer<typeof scenarioSchema>;

export const DEFAULT_SCENARIO: ScenarioInputs = scenarioSchema.parse({
  programme: {
    durationMonths: 12,
    rampMonths: 3,
    currency: "GBP",
    numberFormatLocale: "en-GB",
  },
  market: {
    targetAccounts: 20,
    inMarketRate: 34,
    qualifiedOppsPerAccount: 1.3,
    baselineWinRate: 26,
    baselineAcv: 110_000,
    contributionMargin: 64,
    salesCycleMonthsBaseline: 9,
    salesCycleMonthsAbm: 6,
  },
  uplifts: {
    winRateUplift: 12,
    acvUplift: 18,
    opportunityRateUplift: 25,
  },
  costs: {
    people: 35_000,
    media: 20_000,
    dataTech: 15_000,
    content: 15_000,
    agency: 10_000,
    other: 5_000,
  },
  capacity: {
    source: "budget",
    marketingFte: 3,
    salesFte: 2,
    marketingUtilisation: 70,
    salesUtilisation: 50,
    hoursPerAccount: 12,
  },
  alignment: {
    level: "standard",
  },
  sensitivity: {
    inMarketRange: [24, 34, 44],
    winRateUpliftRange: [6, 12, 18],
    resolution: 5,
  },
});
