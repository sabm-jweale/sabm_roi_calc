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
}

export type CapacitySource = "budget" | "team";

export interface CapacityInputs {
  source: CapacitySource;
  marketingFte: number;
  salesFte: number;
  marketingUtilisation: Float;
  salesUtilisation: Float;
  hoursPerAccount: number;
  budgetCapacityAccounts?: number;
}

export type AlignmentLevel = "poor" | "standard" | "excellent";

export interface AlignmentInputs {
  level: AlignmentLevel;
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
  capacity: CapacityInputs;
  alignment: AlignmentInputs;
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
