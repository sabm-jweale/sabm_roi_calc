import {
  AbmOutputs,
  BaselineOutputs,
  IncrementalOutputs,
  ProgrammeCosts,
  ProgrammeSettings,
  ScenarioInputs,
  ScenarioOutputs,
  ScenarioResult,
  SensitivityCell,
  SensitivityGrid,
} from "./types";
import {
  deriveAlignmentMultipliers,
  deriveCoverage,
  deriveIntensity,
} from "./capacity";

const ONE_HUNDRED = 100;

const toDecimal = (value: number): number => value / ONE_HUNDRED;
const floorZero = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);

export const sumProgrammeCosts = (costs: ProgrammeCosts): number => {
  const override = Number.isFinite(costs.totalOverride) ? floorZero(costs.totalOverride ?? 0) : 0;

  if (override > 0) {
    return override;
  }

  return floorZero(
    costs.people +
      costs.media +
      costs.dataTech +
      costs.content +
      costs.agency +
      costs.other
  );
};

export const calculateBaseline = (inputs: ScenarioInputs["market"]): BaselineOutputs => {
  const inMarketAccounts = floorZero(inputs.targetAccounts * toDecimal(inputs.inMarketRate));
  const qualifiedOpps = floorZero(inMarketAccounts * inputs.qualifiedOppsPerAccount);
  const expectedWins = floorZero(qualifiedOpps * toDecimal(inputs.baselineWinRate));
  const revenue = floorZero(expectedWins * inputs.baselineAcv);
  const grossProfit = floorZero(revenue * toDecimal(inputs.contributionMargin));

  return {
    inMarketAccounts,
    qualifiedOpps,
    expectedWins,
    revenue,
    grossProfit,
  };
};

export const calculateAbm = (
  market: ScenarioInputs["market"],
  baseline: BaselineOutputs,
  uplifts: ScenarioInputs["uplifts"],
): AbmOutputs => {
  const opportunityMultiplier = 1 + toDecimal(uplifts.opportunityRateUplift);
  const qualifiedOpps = floorZero(baseline.inMarketAccounts * market.qualifiedOppsPerAccount * opportunityMultiplier);

  const effectiveWinRate = Math.min(1, Math.max(0, toDecimal(market.baselineWinRate + uplifts.winRateUplift)));
  const expectedWins = floorZero(qualifiedOpps * effectiveWinRate);

  const acv = floorZero(market.baselineAcv * (1 + toDecimal(uplifts.acvUplift)));
  const revenue = floorZero(expectedWins * acv);
  const grossProfit = floorZero(revenue * toDecimal(market.contributionMargin));

  return {
    qualifiedOpps,
    expectedWins,
    acv,
    revenue,
    grossProfit,
  };
};

const calculateRoi = (incrementalGrossProfit: number, totalCost: number): number | null => {
  if (totalCost <= 0) {
    return null;
  }

  return (incrementalGrossProfit - totalCost) / totalCost;
};

const calculateGrossRoi = (incrementalGrossProfit: number, totalCost: number): number | null => {
  if (totalCost <= 0) {
    return null;
  }

  return incrementalGrossProfit / totalCost;
};

const calculateBreakEvenWins = (
  totalCost: number,
  acv: number,
  contributionMargin: number,
): number | null => {
  const marginDecimal = toDecimal(contributionMargin);
  const grossProfitPerWin = acv * marginDecimal;

  if (totalCost <= 0 || grossProfitPerWin <= 0) {
    return null;
  }

  return Math.ceil(totalCost / grossProfitPerWin);
};

const calculateVelocityFactor = (baselineCycle: number, abmCycle: number): number | null => {
  if (abmCycle <= 0) {
    return null;
  }

  return baselineCycle / abmCycle;
};

const calculatePaybackMonths = (
  programme: ProgrammeSettings,
  market: ScenarioInputs["market"],
  incrementalGrossProfit: number,
  totalCost: number,
): number | null => {
  if (incrementalGrossProfit <= 0 || totalCost <= 0 || programme.durationMonths <= 0) {
    return null;
  }

  const velocityFactor = calculateVelocityFactor(
    market.salesCycleMonthsBaseline,
    market.salesCycleMonthsAbm,
  );

  if (!velocityFactor || velocityFactor <= 0) {
    return null;
  }

  const incrementalPerMonth = incrementalGrossProfit / programme.durationMonths;

  if (incrementalPerMonth <= 0) {
    return null;
  }

  return totalCost / (incrementalPerMonth * velocityFactor);
};

export const calculateIncremental = (
  programme: ProgrammeSettings,
  market: ScenarioInputs["market"],
  baseline: BaselineOutputs,
  abm: AbmOutputs,
  costs: ProgrammeCosts,
): IncrementalOutputs => {
  const totalCost = sumProgrammeCosts(costs);
  const incrementalRevenue = abm.revenue - baseline.revenue;
  const incrementalGrossProfit = abm.grossProfit - baseline.grossProfit;
  const incrementalWins = abm.expectedWins - baseline.expectedWins;
  const profitAfterSpend = abm.grossProfit - totalCost;

  return {
    incrementalRevenue,
    incrementalGrossProfit,
    totalCost,
    profitAfterSpend,
    incrementalWins,
    roi: calculateRoi(incrementalGrossProfit, totalCost),
    grossRoi: calculateGrossRoi(incrementalGrossProfit, totalCost),
    breakEvenWins: calculateBreakEvenWins(totalCost, abm.acv, market.contributionMargin),
    paybackMonths: calculatePaybackMonths(programme, market, incrementalGrossProfit, totalCost),
  };
};

export const calculateScenario = (inputs: ScenarioInputs): ScenarioResult => {
  const coverage = deriveCoverage(inputs.market, inputs.capacity);
  const intensity = deriveIntensity(coverage.saturationRate);
  const alignmentMultipliers = deriveAlignmentMultipliers(inputs.alignment);

  const effectiveMarket = {
    ...inputs.market,
    inMarketRate: coverage.coverageRate * ONE_HUNDRED,
  } as ScenarioInputs["market"];

  const effectiveUplifts: ScenarioInputs["uplifts"] = {
    opportunityRateUplift:
      inputs.uplifts.opportunityRateUplift * alignmentMultipliers.opportunity * intensity,
    winRateUplift: inputs.uplifts.winRateUplift * alignmentMultipliers.win * intensity,
    acvUplift: inputs.uplifts.acvUplift * intensity,
  };

  const baseline = calculateBaseline(effectiveMarket);
  const abm = calculateAbm(effectiveMarket, baseline, effectiveUplifts);
  const incremental = calculateIncremental(inputs.programme, effectiveMarket, baseline, abm, inputs.costs);

  const outputs: ScenarioOutputs = {
    baseline,
    abm,
    incremental,
  };

  return {
    inputs,
    outputs,
    guardrails: [],
  };
};

export const buildSensitivityGrid = (inputs: ScenarioInputs): SensitivityGrid =>
  inputs.sensitivity.inMarketRange.map((inMarketRate) =>
    inputs.sensitivity.winRateUpliftRange.map((winRateUplift) => {
      const scenario: ScenarioInputs = {
        ...inputs,
        market: {
          ...inputs.market,
          inMarketRate,
        },
        uplifts: {
          ...inputs.uplifts,
          winRateUplift,
        },
      };

      const result = calculateScenario(scenario);

      const cell: SensitivityCell = {
        inMarketRate,
        winRateUplift,
        roi: result.outputs.incremental.roi,
      };

      return cell;
    }),
  );
