import { AlignmentInputs, AlignmentLevel, CapacityInputs, CapacitySource, MarketFunnelInputs } from "./types";

const MARKETING_MONTHLY_HOURS = 120;
const SALES_MONTHLY_HOURS = 100;

const toDecimal = (value: number): number => value / 100;

const floorZero = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);

export type CapacityBottleneck = "marketing" | "sales" | "balanced";

export interface TeamCapacitySummary {
  marketingHours: number;
  salesHours: number;
  bottleneck: CapacityBottleneck;
  totalHours: number;
  accountCapacity: number;
}

const resolveBottleneck = (marketingHours: number, salesHours: number): CapacityBottleneck => {
  const marketing = floorZero(marketingHours);
  const sales = floorZero(salesHours);

  if (marketing === 0 && sales === 0) {
    return "balanced";
  }

  if (marketing < sales) {
    return "marketing";
  }

  if (sales < marketing) {
    return "sales";
  }

  return "balanced";
};

export const deriveTeamCapacity = (capacity: CapacityInputs): TeamCapacitySummary => {
  const marketingHours =
    floorZero(capacity.marketingFte) * MARKETING_MONTHLY_HOURS * toDecimal(floorZero(capacity.marketingUtilisation));
  const salesHours =
    floorZero(capacity.salesFte) * SALES_MONTHLY_HOURS * toDecimal(floorZero(capacity.salesUtilisation));

  const bottleneck = resolveBottleneck(marketingHours, salesHours);
  const limitingHours = Math.min(marketingHours, salesHours);
  const safeHoursPerAccount = capacity.hoursPerAccount > 0 ? capacity.hoursPerAccount : Number.POSITIVE_INFINITY;
  const accountCapacity = Number.isFinite(safeHoursPerAccount)
    ? Math.max(0, Math.floor(limitingHours / safeHoursPerAccount))
    : 0;

  return {
    marketingHours,
    salesHours,
    bottleneck,
    totalHours: limitingHours,
    accountCapacity,
  };
};

export interface CoverageSummary {
  source: CapacitySource;
  requestedAccounts: number;
  treatedAccounts: number;
  teamCapacityAccounts: number;
  budgetCapacityAccounts: number | null;
  coverageRate: number;
  bottleneck: CapacityBottleneck;
}

export const deriveCoverage = (
  market: MarketFunnelInputs,
  capacity: CapacityInputs,
): CoverageSummary => {
  const safeTargets = floorZero(market.targetAccounts);
  const baseRequested = Math.round(safeTargets * toDecimal(floorZero(market.inMarketRate)));
  const teamCapacity = deriveTeamCapacity(capacity);
  const teamAccounts = teamCapacity.accountCapacity;
  const budgetCapacityRaw =
    capacity.source === "budget" && capacity.budgetCapacityAccounts !== undefined
      ? capacity.budgetCapacityAccounts
      : null;
  const budgetAccounts =
    budgetCapacityRaw !== null && Number.isFinite(budgetCapacityRaw)
      ? Math.max(0, Math.floor(budgetCapacityRaw))
      : null;

  const treatedAccounts = capacity.source === "team"
    ? Math.min(baseRequested, teamAccounts)
    : Math.min(baseRequested, budgetAccounts ?? baseRequested);

  const coverageRate = safeTargets > 0 ? Math.min(1, treatedAccounts / safeTargets) : 0;
  const budgetSummaryCapacity =
    capacity.source === "budget"
      ? (budgetAccounts ?? safeTargets)
      : null;

  return {
    source: capacity.source,
    requestedAccounts: baseRequested,
    treatedAccounts,
    teamCapacityAccounts: teamAccounts,
    budgetCapacityAccounts: budgetSummaryCapacity,
    coverageRate,
    bottleneck: teamCapacity.bottleneck,
  };
};

export const deriveIntensity = (coverageRate: number): number => {
  if (!Number.isFinite(coverageRate) || coverageRate <= 0) {
    return 0;
  }

  return Math.pow(Math.min(1, Math.max(0, coverageRate)), 0.8);
};

export const ALIGNMENT_MULTIPLIERS: Record<AlignmentLevel, {
  opportunity: number;
  win: number;
  velocity: number;
}> = {
  poor: {
    opportunity: 0.8,
    win: 0.85,
    velocity: 0.9,
  },
  standard: {
    opportunity: 1,
    win: 1,
    velocity: 1,
  },
  excellent: {
    opportunity: 1.15,
    win: 1.15,
    velocity: 1.2,
  },
};

export const deriveAlignmentMultipliers = (alignment: AlignmentInputs) =>
  ALIGNMENT_MULTIPLIERS[alignment.level];
