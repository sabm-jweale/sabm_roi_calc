import {
  AbmOutputs,
  BaselineOutputs,
  CoverageOutputs,
  CoverageSettings,
  AbmTier,
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

const isFiniteNumber = (value: number): value is number => Number.isFinite(value);

const TIER_DEFAULTS: Record<AbmTier, { S: number; F: number; alpha: number; gamma: number; range: [number, number] }> = {
  "1to1": { S: 5, F: 0.45, alpha: 0.015, gamma: 0.8, range: [3, 8] },
  "1toFew": { S: 20, F: 0.35, alpha: 0.007, gamma: 0.8, range: [12, 30] },
  "1toMany": { S: 75, F: 0.25, alpha: 0.002, gamma: 0.8, range: [50, 150] },
};

export const computeTierDefaults = (
  tier: AbmTier,
  totalCost: number,
  acv: number,
  targetAccounts: number,
) => {
  const { S, F, alpha, gamma, range } = TIER_DEFAULTS[tier];
  const variablePot = (1 - F) * totalCost;
  const sweetSpot = S;
  const sweetSpotRange = range;
  if (targetAccounts <= 0) {
    const minBudgetDisplayZero = sweetSpot > 0 ? variablePot / sweetSpot : 0;
    const minBudgetFloorZero = alpha * acv;
    const minBudgetZero = Math.max(minBudgetDisplayZero, minBudgetFloorZero);

    return {
      tier,
      sweetSpot,
      sweetSpotRange: { min: sweetSpotRange[0], max: sweetSpotRange[1] },
      fixedCostShare: F,
      alpha,
      gamma,
      variablePot,
      minBudgetDisplay: minBudgetDisplayZero,
      minBudgetFloor: minBudgetFloorZero,
      minBudget: minBudgetZero,
      coverageRate: 0,
      intensity: 0,
    };
  }
  const sweetSpotForBudget = sweetSpot > 0 ? sweetSpot : 1;
  const minBudgetDisplay = sweetSpotForBudget > 0 ? variablePot / sweetSpotForBudget : 0;
  const minBudgetFloor = alpha * acv;
  const minBudget = Math.max(minBudgetDisplay, minBudgetFloor);
  const safeTarget = Math.max(1, targetAccounts);
  const coverageRate = Math.min(1, sweetSpot / safeTarget);
  const intensity = coverageRate > 0 ? Math.pow(coverageRate, gamma) : 0;

  return {
    tier,
    sweetSpot,
    sweetSpotRange: { min: sweetSpotRange[0], max: sweetSpotRange[1] },
    fixedCostShare: F,
    alpha,
    gamma,
    variablePot,
    minBudgetDisplay,
    minBudgetFloor,
    minBudget,
    coverageRate,
    intensity,
  };
};

export const calculateCoverage = (
  market: ScenarioInputs["market"],
  coverage: CoverageSettings,
  costs: ProgrammeCosts,
): CoverageOutputs => {
  const totalCost = sumProgrammeCosts(costs);
  const targetAccounts = floorZero(market.targetAccounts);

  if (targetAccounts <= 0) {
    return {
      targetAccounts,
      treatedAccounts: 0,
      coverageRate: 0,
      intensityFactor: 0,
      budgetTreatableAccounts: 0,
      capacityTreatableAccounts: 0,
      effectiveBudgetPerAccount: null,
      budgetLimited: false,
      capacityLimited: false,
      abmTier: coverage.tier,
      defaultSweetSpot: TIER_DEFAULTS[coverage.tier].S,
      sweetSpotRange: {
        min: TIER_DEFAULTS[coverage.tier].range[0],
        max: TIER_DEFAULTS[coverage.tier].range[1],
      },
      effectiveSweetSpot: 0,
      autoMinBudgetPerAccount: 0,
      minBudgetFloor: 0,
      appliedMinBudgetPerAccount: 0,
      variablePot: 0,
      tierFixedCostShare: TIER_DEFAULTS[coverage.tier].F,
      intensityExponentApplied: coverage.intensityExponent,
    };
  }

  const tierDefaults = computeTierDefaults(
    coverage.tier,
    totalCost,
    market.baselineAcv,
    targetAccounts,
  );

  const customSweetSpot = coverage.maxTreatedAccounts > 0 ? coverage.maxTreatedAccounts : null;
  const effectiveSweetSpot = customSweetSpot ?? tierDefaults.sweetSpot;

  const customMinBudget = coverage.minBudgetPerAccount > 0 ? coverage.minBudgetPerAccount : null;
  const appliedMinBudgetPerAccount = customMinBudget ?? tierDefaults.minBudget;

  const appliedGamma = coverage.intensityExponent > 0 ? coverage.intensityExponent : tierDefaults.gamma;

  const safeSweetSpot = Math.max(0, effectiveSweetSpot);
  const coverageRate = targetAccounts > 0 ? Math.min(1, safeSweetSpot / targetAccounts) : 0;
  const treatedAccounts = floorZero(targetAccounts * coverageRate);

  const intensityFactor = coverageRate > 0 ? Math.pow(coverageRate, appliedGamma) : 0;

  const budgetTreatableRaw =
    appliedMinBudgetPerAccount > 0
      ? tierDefaults.variablePot / appliedMinBudgetPerAccount
      : Number.POSITIVE_INFINITY;
  const budgetTreatableAccounts = floorZero(
    Math.min(budgetTreatableRaw, targetAccounts),
  );

  const capacityTreatableRaw = safeSweetSpot > 0 ? safeSweetSpot : Number.POSITIVE_INFINITY;
  const capacityTreatableAccounts = floorZero(
    Math.min(capacityTreatableRaw, targetAccounts),
  );

  const budgetLimited =
    isFiniteNumber(budgetTreatableRaw) &&
    budgetTreatableAccounts < targetAccounts &&
    budgetTreatableAccounts <= capacityTreatableAccounts;
  const capacityLimited =
    isFiniteNumber(capacityTreatableRaw) &&
    capacityTreatableAccounts < targetAccounts &&
    capacityTreatableAccounts <= budgetTreatableAccounts;

  const effectiveBudgetPerAccount =
    treatedAccounts > 0
      ? tierDefaults.variablePot / treatedAccounts
      : null;

  return {
    targetAccounts,
    treatedAccounts,
    coverageRate,
    intensityFactor,
    budgetTreatableAccounts,
    capacityTreatableAccounts,
    effectiveBudgetPerAccount,
    budgetLimited,
    capacityLimited,
    abmTier: coverage.tier,
    defaultSweetSpot: tierDefaults.sweetSpot,
    sweetSpotRange: tierDefaults.sweetSpotRange,
    effectiveSweetSpot: safeSweetSpot,
    autoMinBudgetPerAccount: tierDefaults.minBudget,
    minBudgetFloor: tierDefaults.minBudgetFloor,
    appliedMinBudgetPerAccount,
    variablePot: tierDefaults.variablePot,
    tierFixedCostShare: tierDefaults.fixedCostShare,
    intensityExponentApplied: appliedGamma,
  };
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
  coverage: CoverageOutputs,
): AbmOutputs => {
  const treatedBaseline =
    coverage.treatedAccounts > 0
      ? calculateBaseline({ ...market, targetAccounts: coverage.treatedAccounts })
      : {
          inMarketAccounts: 0,
          qualifiedOpps: 0,
          expectedWins: 0,
          revenue: 0,
          grossProfit: 0,
        } satisfies BaselineOutputs;

  const untreatedBaseline: BaselineOutputs = {
    inMarketAccounts: floorZero(
      baseline.inMarketAccounts - treatedBaseline.inMarketAccounts,
    ),
    qualifiedOpps: floorZero(
      baseline.qualifiedOpps - treatedBaseline.qualifiedOpps,
    ),
    expectedWins: floorZero(
      baseline.expectedWins - treatedBaseline.expectedWins,
    ),
    revenue: floorZero(baseline.revenue - treatedBaseline.revenue),
    grossProfit: floorZero(
      baseline.grossProfit - treatedBaseline.grossProfit,
    ),
  };

  const opportunityUplift = toDecimal(uplifts.opportunityRateUplift) * coverage.intensityFactor;
  const qualifiedOppsTreated = floorZero(
    treatedBaseline.qualifiedOpps * (1 + opportunityUplift),
  );

  const winRateUplift = uplifts.winRateUplift * coverage.intensityFactor;
  const effectiveWinRate = Math.min(
    1,
    Math.max(0, toDecimal(market.baselineWinRate + winRateUplift)),
  );
  const expectedWinsTreated = floorZero(qualifiedOppsTreated * effectiveWinRate);

  const acvUplift = toDecimal(uplifts.acvUplift) * coverage.intensityFactor;
  const treatedAcv = floorZero(market.baselineAcv * (1 + acvUplift));
  const revenueTreated = floorZero(expectedWinsTreated * treatedAcv);
  const grossProfitTreated = floorZero(
    revenueTreated * toDecimal(market.contributionMargin),
  );

  const qualifiedOpps = floorZero(
    untreatedBaseline.qualifiedOpps + qualifiedOppsTreated,
  );
  const expectedWins = floorZero(
    untreatedBaseline.expectedWins + expectedWinsTreated,
  );
  const revenue = floorZero(untreatedBaseline.revenue + revenueTreated);
  const grossProfit = floorZero(
    untreatedBaseline.grossProfit + grossProfitTreated,
  );

  const acv = coverage.treatedAccounts > 0 ? treatedAcv : market.baselineAcv;

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
  const coverage = calculateCoverage(inputs.market, inputs.coverage, inputs.costs);
  const baseline = calculateBaseline(inputs.market);
  const abm = calculateAbm(inputs.market, baseline, inputs.uplifts, coverage);
  const incremental = calculateIncremental(
    inputs.programme,
    inputs.market,
    baseline,
    abm,
    inputs.costs,
  );

  const outputs: ScenarioOutputs = {
    baseline,
    abm,
    incremental,
    coverage,
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
