import { describe, expect, it } from "vitest";

import {
  buildSensitivityGrid,
  calculateAbm,
  calculateBaseline,
  calculateCoverage,
  calculateIncremental,
  calculateScenario,
  sumProgrammeCosts,
} from "./calculator";
import { ScenarioInputs } from "./types";

const BASE_SCENARIO: ScenarioInputs = {
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
};

const BASE_COVERAGE = calculateCoverage(
  BASE_SCENARIO.market,
  BASE_SCENARIO.coverage,
  BASE_SCENARIO.costs,
);

describe("sumProgrammeCosts", () => {
  it("sums all cost categories", () => {
    expect(sumProgrammeCosts(BASE_SCENARIO.costs)).toBe(470_000);
  });
});

describe("calculateBaseline", () => {
  it("computes baseline funnel and economics", () => {
    const baseline = calculateBaseline(BASE_SCENARIO.market);

    expect(baseline.inMarketAccounts).toBeCloseTo(52.5);
    expect(baseline.qualifiedOpps).toBeCloseTo(31.5);
    expect(baseline.expectedWins).toBeCloseTo(6.93, 5);
    expect(baseline.revenue).toBeCloseTo(450_450);
    expect(baseline.grossProfit).toBeCloseTo(247_747.5);
  });
});

describe("calculateAbm", () => {
  it("applies uplifts to derive abm scenario", () => {
    const baseline = calculateBaseline(BASE_SCENARIO.market);
    const abm = calculateAbm(
      BASE_SCENARIO.market,
      baseline,
      BASE_SCENARIO.uplifts,
      BASE_COVERAGE,
    );

    expect(abm.qualifiedOpps).toBeCloseTo(31.709, 3);
    expect(abm.expectedWins).toBeCloseTo(7.0817, 4);
    expect(abm.acv).toBeCloseTo(67_334.19, 2);
    expect(abm.revenue).toBeCloseTo(462_818.042, 3);
    expect(abm.grossProfit).toBeCloseTo(254_549.923, 3);
  });
});

describe("calculateIncremental", () => {
  it("derives incremental metrics, roi, break even, and payback", () => {
    const baseline = calculateBaseline(BASE_SCENARIO.market);
    const abm = calculateAbm(
      BASE_SCENARIO.market,
      baseline,
      BASE_SCENARIO.uplifts,
      BASE_COVERAGE,
    );
    const incremental = calculateIncremental(
      BASE_SCENARIO.programme,
      BASE_SCENARIO.market,
      baseline,
      abm,
      BASE_SCENARIO.costs,
    );

    expect(incremental.incrementalRevenue).toBeCloseTo(12_368.042, 3);
    expect(incremental.incrementalGrossProfit).toBeCloseTo(6_802.423, 3);
    expect(incremental.roi).toBeCloseTo(-0.9855, 4);
    expect(incremental.breakEvenWins).toBe(13);
    expect(incremental.paybackMonths).toBeCloseTo(552.74, 2);
  });

  it("returns null ROI and payback when programme cost is zero", () => {
    const baseline = calculateBaseline(BASE_SCENARIO.market);
    const zeroCosts = {
      ...BASE_SCENARIO.costs,
      people: 0,
      media: 0,
      dataTech: 0,
      content: 0,
      agency: 0,
      other: 0,
    } as const;
    const zeroCoverage = calculateCoverage(
      BASE_SCENARIO.market,
      BASE_SCENARIO.coverage,
      zeroCosts,
    );
    const abm = calculateAbm(
      BASE_SCENARIO.market,
      baseline,
      BASE_SCENARIO.uplifts,
      zeroCoverage,
    );
    const incremental = calculateIncremental(
      BASE_SCENARIO.programme,
      BASE_SCENARIO.market,
      baseline,
      abm,
      zeroCosts,
    );

    expect(incremental.roi).toBeNull();
    expect(incremental.breakEvenWins).toBeNull();
    expect(incremental.paybackMonths).toBeNull();
  });
});

describe("calculateScenario", () => {
  it("bundles inputs and outputs in the scenario result", () => {
    const result = calculateScenario(BASE_SCENARIO);

    expect(result.inputs).toEqual(BASE_SCENARIO);
    expect(result.guardrails).toEqual([]);
    expect(result.outputs.incremental.incrementalRevenue).toBeGreaterThan(0);
    expect(result.outputs.coverage.coverageRate).toBeGreaterThan(0);
  });
});

describe("buildSensitivityGrid", () => {
  it("produces roi cells for each sensitivity combination", () => {
    const grid = buildSensitivityGrid(BASE_SCENARIO);

    expect(grid).toHaveLength(BASE_SCENARIO.sensitivity.inMarketRange.length);
    expect(grid[0]).toHaveLength(
      BASE_SCENARIO.sensitivity.winRateUpliftRange.length,
    );

    const targetInMarket = BASE_SCENARIO.sensitivity.inMarketRange[1];
    const targetWinUplift = BASE_SCENARIO.sensitivity.winRateUpliftRange[2];
    const manualScenario = calculateScenario({
      ...BASE_SCENARIO,
      market: { ...BASE_SCENARIO.market, inMarketRate: targetInMarket },
      uplifts: { ...BASE_SCENARIO.uplifts, winRateUplift: targetWinUplift },
    });

    expect(grid[1][2].roi).toBeCloseTo(
      manualScenario.outputs.incremental.roi ?? 0,
      5,
    );
  });
});
