export type CurrencyCode = "GBP" | "USD" | "EUR";

type Float = number;

export interface ProgrammeSettings {
  durationMonths: number;
  rampMonths: number;
  currency: CurrencyCode;
  numberFormatLocale: string;
}

export interface MarketFunnelInputs {
  targetAccounts: number;
  inMarketRate: Float;
  qualifiedOppsPerAccount: Float;
  baselineWinRate: Float;
  baselineAcv: number;
  contributionMargin: Float;
  salesCycleMonthsBaseline: number;
  salesCycleMonthsAbm: number;
}

export interface UpliftInputs {
  winRateUplift: Float;
  acvUplift: Float;
  opportunityRateUplift: Float;
}

export interface ProgrammeCosts {
  people: number;
  media: number;
  dataTech: number;
  content: number;
  agency: number;
  other: number;
  totalOverride?: number;
}

export type AbmTier = "1to1" | "1toFew" | "1toMany";

export interface CoverageSettings {
  tier: AbmTier;
  minBudgetPerAccount: number;
  maxTreatedAccounts: number;
  intensityExponent: Float;
}

export interface CoverageOutputs {
  targetAccounts: number;
  treatedAccounts: number;
  coverageRate: Float;
  intensityFactor: Float;
  budgetTreatableAccounts: number;
  capacityTreatableAccounts: number;
  effectiveBudgetPerAccount: number | null;
  budgetLimited: boolean;
  capacityLimited: boolean;
  abmTier: AbmTier;
  defaultSweetSpot: number;
  sweetSpotRange: { min: number; max: number };
  effectiveSweetSpot: number;
  autoMinBudgetPerAccount: number;
  minBudgetFloor: number;
  appliedMinBudgetPerAccount: number;
  variablePot: number;
  tierFixedCostShare: Float;
  intensityExponentApplied: Float;
}

export interface SensitivityConfig {
  inMarketRange: Float[];
  winRateUpliftRange: Float[];
  resolution?: number;
}

export interface ScenarioInputs {
  programme: ProgrammeSettings;
  market: MarketFunnelInputs;
  uplifts: UpliftInputs;
  costs: ProgrammeCosts;
  coverage: CoverageSettings;
  sensitivity: SensitivityConfig;
}

export interface BaselineOutputs {
  inMarketAccounts: number;
  qualifiedOpps: Float;
  expectedWins: Float;
  revenue: number;
  grossProfit: number;
}

export interface AbmOutputs {
  qualifiedOpps: Float;
  expectedWins: Float;
  acv: number;
  revenue: number;
  grossProfit: number;
}

export interface IncrementalOutputs {
  incrementalRevenue: number;
  incrementalGrossProfit: number;
  roi: Float | null;
  breakEvenWins: number | null;
  paybackMonths: Float | null;
}

export interface ScenarioOutputs {
  baseline: BaselineOutputs;
  abm: AbmOutputs;
  incremental: IncrementalOutputs;
  coverage: CoverageOutputs;
}

export type GuardrailLevel = "info" | "warning" | "error";

export interface Guardrail {
  section:
    | "programme"
    | "market"
    | "uplifts"
    | "costs"
    | "sensitivity";
  field: string;
  level: GuardrailLevel;
  message: string;
}

export interface ScenarioResult {
  inputs: ScenarioInputs;
  outputs: ScenarioOutputs;
  guardrails: Guardrail[];
}

export interface SensitivityCell {
  inMarketRate: Float;
  winRateUplift: Float;
  roi: Float | null;
}

export type SensitivityGrid = SensitivityCell[][];
