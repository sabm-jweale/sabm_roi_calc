import { z } from "zod";

import { CurrencyCode, ScenarioInputs } from "./types";

const currencyEnum = z.enum(["GBP", "USD", "EUR"] satisfies CurrencyCode[]);

export const programmeSchema = z
  .object({
    durationMonths: z.number().min(0).max(24),
    rampMonths: z.number().min(0).max(24),
    currency: currencyEnum,
    numberFormatLocale: z.string().min(2),
  })
  .refine((value) => value.rampMonths <= value.durationMonths, {
    path: ["rampMonths"],
    message: "Ramp-up must be less than or equal to duration.",
  });

export const marketSchema = z
  .object({
    targetAccounts: z.number().min(0).max(2000),
    inMarketRate: z.number().min(0).max(70),
    qualifiedOppsPerAccount: z.number().min(0).max(3),
    baselineWinRate: z.number().min(0).max(60),
    baselineAcv: z.number().min(0),
    contributionMargin: z.number().min(0).max(95),
    salesCycleMonthsBaseline: z.number().min(0).max(24),
    salesCycleMonthsAbm: z.number().min(0).max(24),
  })
  .refine((value) => value.salesCycleMonthsAbm <= value.salesCycleMonthsBaseline, {
    path: ["salesCycleMonthsAbm"],
    message: "ABM cycle must be <= baseline cycle.",
  });

export const upliftSchema = z.object({
  winRateUplift: z.number().min(0).max(20),
  acvUplift: z.number().min(-30).max(100),
  opportunityRateUplift: z.number().min(0).max(100),
});

export const costsSchema = z
  .object({
    people: z.number().min(0),
    media: z.number().min(0),
    dataTech: z.number().min(0),
    content: z.number().min(0),
    agency: z.number().min(0),
    other: z.number().min(0),
    totalOverride: z.number().min(0).optional(),
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

const tierEnum = z.enum(["1to1", "1toFew", "1toMany"]);

export const coverageSchema = z.object({
  tier: tierEnum,
  minBudgetPerAccount: z.number().min(0),
  maxTreatedAccounts: z.number().min(0),
  intensityExponent: z.number().min(0.1).max(2),
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
    qualifiedOppsPerAccount: 1,
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
