import { describe, expect, it } from "vitest";

import {
  buildSensitivityGrid,
  calculateAbm,
  calculateBaseline,
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
  sensitivity: {
    inMarketRange: [25, 35, 45],
    winRateUpliftRange: [5, 10, 15],
    resolution: 5,
  },
};

describe("sumProgrammeCosts", () => {
  it("sums all cost categories", () => {
    expect(sumProgrammeCosts(BASE_SCENARIO.costs)).toBe(470_000);
  });
});

describe("calculateBaseline", () => {
  it("computes baseline funnel and economics", () => {
    const baseline = calculateBaseline(BASE_SCENARIO.market);

    expect(baseline.inMarketAccounts).toBeCloseTo(52.5);
    expect(baseline.qualifiedOpps).toBeCloseTo(52.5);
    expect(baseline.expectedWins).toBeCloseTo(11.55, 5);
    expect(baseline.revenue).toBeCloseTo(750_750);
    expect(baseline.grossProfit).toBeCloseTo(412_912.5);
  });
});

describe("calculateAbm", () => {
  it("applies uplifts to derive abm scenario", () => {
    const baseline = calculateBaseline(BASE_SCENARIO.market);
    const abm = calculateAbm(BASE_SCENARIO.market, baseline, BASE_SCENARIO.uplifts);

    expect(abm.qualifiedOpps).toBeCloseTo(65.625);
    expect(abm.expectedWins).toBeCloseTo(22.3125, 5);
    expect(abm.acv).toBeCloseTo(76_700);
    expect(abm.revenue).toBeCloseTo(1_711_368.75);
    expect(abm.grossProfit).toBeCloseTo(941_252.8125, 4);
  });
});

describe("calculateIncremental", () => {
  it("derives incremental metrics, roi, break even, and payback", () => {
    const baseline = calculateBaseline(BASE_SCENARIO.market);
    const abm = calculateAbm(BASE_SCENARIO.market, baseline, BASE_SCENARIO.uplifts);
    const incremental = calculateIncremental(
      BASE_SCENARIO.programme,
      BASE_SCENARIO.market,
      baseline,
      abm,
      BASE_SCENARIO.costs,
    );

    expect(incremental.incrementalRevenue).toBeCloseTo(960_618.75);
    expect(incremental.incrementalGrossProfit).toBeCloseTo(528_340.3125, 4);
    expect(incremental.roi).toBeCloseTo(0.1241, 4);
    expect(incremental.breakEvenWins).toBe(12);
    expect(incremental.paybackMonths).toBeCloseTo(7.12, 2);
  });

  it("returns null ROI and payback when programme cost is zero", () => {
    const baseline = calculateBaseline(BASE_SCENARIO.market);
    const abm = calculateAbm(BASE_SCENARIO.market, baseline, BASE_SCENARIO.uplifts);
    const incremental = calculateIncremental(
      BASE_SCENARIO.programme,
      BASE_SCENARIO.market,
      baseline,
      abm,
      { ...BASE_SCENARIO.costs, people: 0, media: 0, dataTech: 0, content: 0, agency: 0, other: 0 },
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
