import type { CurrencyCode } from "@/lib/calculator/types";

const NA_SYMBOL = "\u2014";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const formatNumber = (
  value: number | null | undefined,
  locale: string,
  options?: { fractionDigits?: number },
): string => {
  if (!isFiniteNumber(value)) {
    return NA_SYMBOL;
  }

  const fractionDigits = options?.fractionDigits ?? 1;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
};

export const formatCurrency = (
  value: number | null | undefined,
  locale: string,
  currency: CurrencyCode,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string => {
  if (!isFiniteNumber(value)) {
    return NA_SYMBOL;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(value);
};

export const formatPercent = (
  value: number | null | undefined,
  locale: string,
  options?: { fractionDigits?: number; suffix?: string },
): string => {
  const fractionDigits = options?.fractionDigits ?? 1;
  const suffix = options?.suffix ?? "%";
  const formatted = formatNumber(value, locale, { fractionDigits });

  if (formatted === NA_SYMBOL) {
    return NA_SYMBOL;
  }

  return `${formatted}${suffix}`;
};

export { NA_SYMBOL };
