export type DeriveInMarketInput = {
  durationMonths: number;
  rampMonths: number;
  buyingWindowMonths?: number;
  pointInTimeShare?: number;
};

const DEFAULT_POINT_IN_TIME_SHARE = 0.05;
const MIN_BUYING_WINDOW_MONTHS = 1;

export function deriveInMarketPct({
  durationMonths,
  rampMonths,
  buyingWindowMonths = 3,
  pointInTimeShare = DEFAULT_POINT_IN_TIME_SHARE,
}: DeriveInMarketInput): number {
  const windowMonths = Math.max(0, Number.isFinite(durationMonths) ? durationMonths : 0) -
    Math.max(0, Number.isFinite(rampMonths) ? rampMonths : 0);
  if (!Number.isFinite(windowMonths) || windowMonths <= 0) {
    return 0;
  }

  const activeWindow = Math.max(MIN_BUYING_WINDOW_MONTHS, buyingWindowMonths);
  const share = Math.max(0, Math.min(1, pointInTimeShare));
  if (share === 0) {
    return 0;
  }

  const monthlyHazard = Math.min(0.99, share / activeWindow);
  const derived = 1 - Math.pow(1 - monthlyHazard, windowMonths);
  if (!Number.isFinite(derived)) {
    return 0;
  }

  return Math.max(0, Math.min(1, derived));
}
