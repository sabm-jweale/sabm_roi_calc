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

const ONE_HUNDRED = 100;

const toDecimal = (value: number): number => value / ONE_HUNDRED;
const floorZero = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);

export const sumProgrammeCosts = (costs: ProgrammeCosts): number =>
  floorZero(
    costs.people +
      costs.media +
      costs.dataTech +
      costs.content +
      costs.agency +
      costs.other
  );

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
  const incrementalRevenue = floorZero(abm.revenue - baseline.revenue);
  const incrementalGrossProfit = floorZero(abm.grossProfit - baseline.grossProfit);

  return {
    incrementalRevenue,
    incrementalGrossProfit,
    roi: calculateRoi(incrementalGrossProfit, totalCost),
    breakEvenWins: calculateBreakEvenWins(totalCost, abm.acv, market.contributionMargin),
    paybackMonths: calculatePaybackMonths(programme, market, incrementalGrossProfit, totalCost),
  };
};

export const calculateScenario = (inputs: ScenarioInputs): ScenarioResult => {
  const baseline = calculateBaseline(inputs.market);
  const abm = calculateAbm(inputs.market, baseline, inputs.uplifts);
  const incremental = calculateIncremental(inputs.programme, inputs.market, baseline, abm, inputs.costs);

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
