import { describe, expect, it } from "vitest";

import {
  buildSensitivityGrid,
  calculateAbm,
  calculateBaseline,
  calculateIncremental,
  calculateScenario,
  sumProgrammeCosts,
} from "./calculator";
import { deriveCoverage } from "./capacity";
import { AbmOutputs, ScenarioInputs } from "./types";

const BASE_SCENARIO: ScenarioInputs = {
  programme: {
    durationMonths: 12,
    rampMonths: 3,
    currency: "GBP",
    numberFormatLocale: "en-GB",
  },
  market: {
    targetAccounts: 110,
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
    people: 170_000,
    media: 70_000,
    dataTech: 30_000,
    content: 42_000,
    agency: 26_000,
    other: 12_000,
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
};

describe("sumProgrammeCosts", () => {
  it("sums all cost categories", () => {
    expect(sumProgrammeCosts(BASE_SCENARIO.costs)).toBe(350_000);
  });

  it("prefers override when provided", () => {
    const overrideCosts = {
      people: 0,
      media: 0,
      dataTech: 0,
      content: 0,
      agency: 0,
      other: 0,
      totalOverride: 500_000,
    } satisfies ScenarioInputs["costs"];

    expect(sumProgrammeCosts(overrideCosts)).toBe(500_000);
  });
});

describe("calculateBaseline", () => {
  it("computes baseline funnel and economics", () => {
    const baseline = calculateBaseline(BASE_SCENARIO.market);

    expect(baseline.inMarketAccounts).toBeCloseTo(37.4);
    expect(baseline.qualifiedOpps).toBeCloseTo(48.62);
    expect(baseline.expectedWins).toBeCloseTo(12.6412, 5);
    expect(baseline.revenue).toBeCloseTo(1_390_532, 3);
    expect(baseline.grossProfit).toBeCloseTo(889_940.48, 2);
  });
});

describe("calculateAbm", () => {
  it("applies uplifts to derive abm scenario", () => {
    const baseline = calculateBaseline(BASE_SCENARIO.market);
    const abm = calculateAbm(BASE_SCENARIO.market, baseline, BASE_SCENARIO.uplifts);

    expect(abm.qualifiedOpps).toBeCloseTo(60.775);
    expect(abm.expectedWins).toBeCloseTo(23.0945, 5);
    expect(abm.acv).toBeCloseTo(129_800);
    expect(abm.revenue).toBeCloseTo(2_997_666.1, 3);
    expect(abm.grossProfit).toBeCloseTo(1_918_506.304, 3);
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

    expect(incremental.incrementalRevenue).toBeCloseTo(1_607_134.1, 3);
    expect(incremental.incrementalGrossProfit).toBeCloseTo(1_028_565.824, 3);
    expect(incremental.totalCost).toBe(350_000);
    expect(incremental.profitAfterSpend).toBeCloseTo(abm.grossProfit - incremental.totalCost, 4);
    expect(incremental.grossRoi).toBeCloseTo(incremental.incrementalGrossProfit / incremental.totalCost, 6);
    expect(incremental.roi).toBeCloseTo(1.9388, 4);
    expect(incremental.breakEvenWins).toBe(5);
    expect(incremental.paybackMonths).toBeCloseTo(2.72, 2);
    expect(incremental.incrementalWins).toBeCloseTo(abm.expectedWins - baseline.expectedWins, 5);
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
    expect(incremental.grossRoi).toBeNull();
    expect(incremental.breakEvenWins).toBeNull();
    expect(incremental.paybackMonths).toBeNull();
    expect(incremental.totalCost).toBe(0);
    expect(incremental.profitAfterSpend).toBeCloseTo(abm.grossProfit, 5);
    expect(incremental.incrementalWins).toBeCloseTo(abm.expectedWins - baseline.expectedWins, 5);
  });

  it("allows negative incremental results when ABM underperforms and respects overrides", () => {
    const baseline = calculateBaseline(BASE_SCENARIO.market);
    const weakerAbm: AbmOutputs = {
      qualifiedOpps: baseline.qualifiedOpps * 0.8,
      expectedWins: baseline.expectedWins * 0.75,
      acv: BASE_SCENARIO.market.baselineAcv * 0.9,
      revenue: baseline.revenue * 0.7,
      grossProfit: baseline.grossProfit * 0.65,
    };

    const costsWithOverride: ScenarioInputs["costs"] = {
      people: 0,
      media: 0,
      dataTech: 0,
      content: 0,
      agency: 0,
      other: 0,
      totalOverride: 120_000,
    };

    const incremental = calculateIncremental(
      BASE_SCENARIO.programme,
      BASE_SCENARIO.market,
      baseline,
      weakerAbm,
      costsWithOverride,
    );

    expect(incremental.incrementalRevenue).toBeLessThan(0);
    expect(incremental.incrementalGrossProfit).toBeLessThan(0);
    expect(incremental.totalCost).toBe(120_000);
    expect(incremental.roi).toBeLessThan(-1);
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

describe("deriveCoverage", () => {
  it("caps treated accounts by budget capacity when budget is limiting", () => {
    const market = {
      ...BASE_SCENARIO.market,
      targetAccounts: 20,
      inMarketRate: 50,
    };

    const coverage = deriveCoverage(market, {
      ...BASE_SCENARIO.capacity,
      source: "budget",
      budgetCapacityAccounts: 5,
    });

    expect(coverage.requestedAccounts).toBe(10);
    expect(coverage.treatedAccounts).toBe(5);
    expect(coverage.budgetCapacityAccounts).toBe(5);
    expect(coverage.saturationRate).toBeCloseTo(0.5);
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
