import { z } from "zod";

import { CurrencyCode, ScenarioInputs } from "./types";

const currencyEnum = z.enum(["GBP", "USD", "EUR"] satisfies CurrencyCode[]);

const normalizeNumber = (schema: z.ZodNumber) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return 0;
    }

    return value;
  }, schema);

const percentage = (min: number, max: number) =>
  normalizeNumber(
    z
      .number({ invalid_type_error: "Enter a percentage." })
      .min(min, { message: `Must be ≥ ${min}%.` })
      .max(max, { message: `Must be ≤ ${max}%.` }),
  );

export const programmeSchema = z
  .object({
    durationMonths: normalizeNumber(z.number().min(0).max(24)),
    rampMonths: normalizeNumber(z.number().min(0).max(24)),
    currency: currencyEnum,
    numberFormatLocale: z.string().min(2),
  })
  .refine((value) => value.rampMonths <= value.durationMonths, {
    path: ["rampMonths"],
    message: "Ramp-up must be less than or equal to duration.",
  });

export const marketSchema = z
  .object({
    targetAccounts: normalizeNumber(z.number().min(0).max(2000)),
    inMarketRate: percentage(0, 70),
    qualifiedOppsPerAccount: normalizeNumber(z.number().min(0).max(3)),
    baselineWinRate: percentage(0, 60),
    baselineAcv: normalizeNumber(z.number().min(0)),
    contributionMargin: percentage(0, 95),
    salesCycleMonthsBaseline: normalizeNumber(z.number().min(0).max(24)),
    salesCycleMonthsAbm: normalizeNumber(z.number().min(0).max(24)),
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
    people: normalizeNumber(z.number().min(0)),
    media: normalizeNumber(z.number().min(0)),
    dataTech: normalizeNumber(z.number().min(0)),
    content: normalizeNumber(z.number().min(0)),
    agency: normalizeNumber(z.number().min(0)),
    other: normalizeNumber(z.number().min(0)),
  })
  .refine((value) => Object.values(value).some((cost) => cost > 0), {
    message: "At least one cost line must be greater than zero.",
  });

const tierEnum = z.enum(["1to1", "1toFew", "1toMany"]);

export const coverageSchema = z.object({
  tier: tierEnum,
  minBudgetPerAccount: normalizeNumber(z.number().min(0)),
  maxTreatedAccounts: normalizeNumber(z.number().min(0)),
  intensityExponent: normalizeNumber(z.number().min(0.1).max(2)),
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
  coverage: coverageSchema,
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
    inMarketRate: 35,
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
  coverage: {
    tier: "1toFew",
    minBudgetPerAccount: 0,
    maxTreatedAccounts: 0,
    intensityExponent: 0.8,
  },
  sensitivity: {
    inMarketRange: [25, 35, 45],
    winRateUpliftRange: [5, 10, 15],
    resolution: 5,
  },
});
