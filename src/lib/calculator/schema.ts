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
  })
  .refine((value) => Object.values(value).some((cost) => cost > 0), {
    message: "At least one cost line must be greater than zero.",
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
    targetAccounts: 150,
    inMarketRate: 18,
    qualifiedOppsPerAccount: 0.6,
    baselineWinRate: 22,
    baselineAcv: 65_000,
    contributionMargin: 55,
    salesCycleMonthsBaseline: 9,
    salesCycleMonthsAbm: 6,
  },
  uplifts: {
    winRateUplift: 12,
    acvUplift: 18,
    opportunityRateUplift: 25,
  },
  costs: {
    people: 220_000,
    media: 90_000,
    dataTech: 45_000,
    content: 60_000,
    agency: 40_000,
    other: 15_000,
  },
  sensitivity: {
    inMarketRange: [12, 18, 24],
    winRateUpliftRange: [5, 10, 15],
    resolution: 5,
  },
});
