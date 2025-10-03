"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useForm, type Control, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildSensitivityGrid, calculateScenario } from "@/lib/calculator/calculator";
import {
  DEFAULT_SCENARIO,
  scenarioSchema,
  type ScenarioInputSchema,
} from "@/lib/calculator/schema";
import {
  formatCurrency as formatCurrencyIntl,
  formatNumber as formatNumberIntl,
  formatPercent as formatPercentIntl,
} from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

const numberParser = (value: string) => {
  if (value === "") {
    return "";
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

const CURRENCY_OPTIONS = [
  { value: "GBP", label: "GBP (£)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
] as const;

const CURRENCY_HINT = "Currency used for on-screen values and exports.";

const LOCALE_OPTIONS = [
  { value: "en-GB", label: "English (UK)" },
  { value: "en-US", label: "English (US)" },
  { value: "de-DE", label: "German (EU)" },
] as const;

const NUMBER_FORMAT_HINT = "Locale controls thousand separators and decimal punctuation.";

const programmeFields: Array<{
  name: FieldPath<ScenarioInputSchema>;
  label: string;
  hint: string;
}> = [
  {
    name: "programme.durationMonths",
    label: "Programme duration (months)",
    hint: "Total length of the planned ABM programme, including ramp phase.",
  },
  {
    name: "programme.rampMonths",
    label: "Ramp-up period (months)",
    hint: "How many months until ABM impact reaches steady-state.",
  },
];

const marketFields: Array<{
  name: FieldPath<ScenarioInputSchema>;
  label: string;
  prefix?: string;
  hint: string;
}> = [
  {
    name: "market.targetAccounts",
    label: "Target accounts",
    hint: "Total accounts in scope for this ABM programme.",
  },
  {
    name: "market.inMarketRate",
    label: "In-market rate (%)",
    hint: "% of target accounts currently in-market or with active demand.",
  },
  {
    name: "market.qualifiedOppsPerAccount",
    label: "Qualified opps per in-market account",
    hint: "Average sales-qualified opportunities you expect per in-market account.",
  },
  {
    name: "market.baselineWinRate",
    label: "Baseline win rate (%)",
    hint: "Historical close rate without ABM influence (percentage).",
  },
  {
    name: "market.baselineAcv",
    label: "Baseline ACV",
    prefix: "£",
    hint: "Average contract value per deal before ABM uplift.",
  },
  {
    name: "market.contributionMargin",
    label: "Contribution margin (%)",
    hint: "Gross margin expected on recognised revenue for this programme.",
  },
  {
    name: "market.salesCycleMonthsBaseline",
    label: "Sales cycle (baseline months)",
    hint: "Typical time to close a deal today, in months.",
  },
  {
    name: "market.salesCycleMonthsAbm",
    label: "Sales cycle (ABM months)",
    hint: "Expected time to close when ABM is in-market.",
  },
];

const upliftFields: Array<{
  name: FieldPath<ScenarioInputSchema>;
  label: string;
  hint: string;
}> = [
  {
    name: "uplifts.winRateUplift",
    label: "Win-rate uplift (pp)",
    hint: "Absolute percentage point increase to win rate expected from ABM.",
  },
  {
    name: "uplifts.acvUplift",
    label: "ACV uplift (%)",
    hint: "% increase in deal size when ABM is active.",
  },
  {
    name: "uplifts.opportunityRateUplift",
    label: "Opportunity-rate uplift (%)",
    hint: "% increase in opportunities per in-market account.",
  },
];

const costFields: Array<{
  name: FieldPath<ScenarioInputSchema>;
  label: string;
  prefix?: string;
  hint: string;
}> = [
  {
    name: "costs.people",
    label: "People cost",
    prefix: "£",
    hint: "Internal headcount cost attributed to the programme.",
  },
  {
    name: "costs.media",
    label: "Media",
    prefix: "£",
    hint: "Paid media budget dedicated to ABM tactics.",
  },
  {
    name: "costs.dataTech",
    label: "Data & tech",
    prefix: "£",
    hint: "Platforms, intent data, enrichment, and tooling costs.",
  },
  {
    name: "costs.content",
    label: "Content",
    prefix: "£",
    hint: "Content creation, personalization, and asset production spend.",
  },
  {
    name: "costs.agency",
    label: "Agency & partners",
    prefix: "£",
    hint: "External partner and agency fees supporting the programme.",
  },
  {
    name: "costs.other",
    label: "Other",
    prefix: "£",
    hint: "Any additional investments not captured above.",
  },
];

export function ScenarioPlanner() {
  const form = useForm<ScenarioInputSchema>({
    resolver: zodResolver(scenarioSchema),
    defaultValues: DEFAULT_SCENARIO,
    mode: "onChange",
  });

  const watchedInputs = form.watch();

  const sanitizedInputs = useMemo(() => {
    const toNumber = (value: unknown, fallback = 0) => {
      if (value === "" || value === undefined || value === null) {
        return fallback;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    return {
      programme: {
        durationMonths: toNumber(watchedInputs.programme?.durationMonths),
        rampMonths: toNumber(watchedInputs.programme?.rampMonths),
        currency:
          watchedInputs.programme?.currency ?? DEFAULT_SCENARIO.programme.currency,
        numberFormatLocale:
          watchedInputs.programme?.numberFormatLocale ??
          DEFAULT_SCENARIO.programme.numberFormatLocale,
      },
      market: {
        targetAccounts: toNumber(watchedInputs.market?.targetAccounts),
        inMarketRate: toNumber(watchedInputs.market?.inMarketRate),
        qualifiedOppsPerAccount: toNumber(
          watchedInputs.market?.qualifiedOppsPerAccount,
        ),
        baselineWinRate: toNumber(watchedInputs.market?.baselineWinRate),
        baselineAcv: toNumber(watchedInputs.market?.baselineAcv),
        contributionMargin: toNumber(watchedInputs.market?.contributionMargin),
        salesCycleMonthsBaseline: toNumber(
          watchedInputs.market?.salesCycleMonthsBaseline,
        ),
        salesCycleMonthsAbm: toNumber(watchedInputs.market?.salesCycleMonthsAbm),
      },
      uplifts: {
        winRateUplift: toNumber(watchedInputs.uplifts?.winRateUplift),
        acvUplift: toNumber(watchedInputs.uplifts?.acvUplift),
        opportunityRateUplift: toNumber(
          watchedInputs.uplifts?.opportunityRateUplift,
        ),
      },
      costs: {
        people: toNumber(watchedInputs.costs?.people),
        media: toNumber(watchedInputs.costs?.media),
        dataTech: toNumber(watchedInputs.costs?.dataTech),
        content: toNumber(watchedInputs.costs?.content),
        agency: toNumber(watchedInputs.costs?.agency),
        other: toNumber(watchedInputs.costs?.other),
      },
      sensitivity: {
        inMarketRange:
          watchedInputs.sensitivity?.inMarketRange?.length
            ? watchedInputs.sensitivity.inMarketRange.map((value) =>
                toNumber(value),
              )
            : [...DEFAULT_SCENARIO.sensitivity.inMarketRange],
        winRateUpliftRange:
          watchedInputs.sensitivity?.winRateUpliftRange?.length
            ? watchedInputs.sensitivity.winRateUpliftRange.map((value) =>
                toNumber(value),
              )
            : [...DEFAULT_SCENARIO.sensitivity.winRateUpliftRange],
        resolution: watchedInputs.sensitivity?.resolution ??
          DEFAULT_SCENARIO.sensitivity.resolution,
      },
    } satisfies ScenarioInputSchema;
  }, [watchedInputs]);

  const scenarioResult = useMemo(() => {
    const parsed = scenarioSchema.safeParse(sanitizedInputs);
    if (!parsed.success) {
      return null;
    }

    return calculateScenario(parsed.data);
  }, [sanitizedInputs]);

  const sensitivityGrid = useMemo(() => {
    if (!scenarioResult) {
      return null;
    }

    return buildSensitivityGrid(scenarioResult.inputs);
  }, [scenarioResult]);

  const locale =
    sanitizedInputs.programme.numberFormatLocale ??
    DEFAULT_SCENARIO.programme.numberFormatLocale;
  const currency =
    sanitizedInputs.programme.currency ?? DEFAULT_SCENARIO.programme.currency;

  const formatCurrencyValue = (
    value: number | null | undefined,
    fractionDigits = 0,
  ) =>
    formatCurrencyIntl(value, locale, currency, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });

  const formatNumberValue = (
    value: number | null | undefined,
    fractionDigits = 1,
  ) => formatNumberIntl(value, locale, { fractionDigits });

  const formatPercentValue = (
    value: number | null | undefined,
    fractionDigits = 1,
  ) => formatPercentIntl(value, locale, { fractionDigits });

  return (
    <TooltipProvider delayDuration={200}>
      <Form {...form}>
        <form className="min-h-dvh bg-background" noValidate>
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 lg:gap-8 lg:px-10">
          <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div className="space-y-3">
              <Image
                src="/img/strategicabm_logoforwhitebg_web.jpg"
                alt="strategicabm wordmark"
                width={240}
                height={60}
                priority
                className="h-auto w-48 sm:w-60"
              />
              <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
                ABM ROI Calculator
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground">
                Capture programme assumptions, model baseline versus ABM scenarios, and export a
                client-ready business case.
              </p>
            </div>
            <Button size="lg" className="self-start bg-cta text-white hover:bg-cta/90" disabled>
              Export (coming soon)
            </Button>
          </header>

          <main className="grid gap-6 lg:grid-cols-[2fr_1fr] xl:gap-8">
            <section className="flex flex-col gap-6 lg:gap-8">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Programme Settings</CardTitle>
                  <CardDescription>
                    Duration, ramp, and formatting controls that gate downstream calculations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  {programmeFields.map((field) => (
                    <NumberField
                      key={field.name}
                      control={form.control}
                      name={field.name}
                      label={field.label}
                      hint={field.hint}
                    />
                  ))}

                  <FormField
                    control={form.control}
                    name="programme.currency"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between gap-2">
                          <FormLabel>Currency</FormLabel>
                          <HintTooltip hint={CURRENCY_HINT} label="Currency" />
                        </div>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {CURRENCY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="programme.numberFormatLocale"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between gap-2">
                          <FormLabel>Number formatting</FormLabel>
                          <HintTooltip
                            hint={NUMBER_FORMAT_HINT}
                            label="Number formatting"
                          />
                        </div>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {LOCALE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Market & Funnel Inputs</CardTitle>
                  <CardDescription>
                    Manual entries for addressable accounts, funnels, and baseline conversion metrics.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  {marketFields.map((field) => (
                    <NumberField
                      key={field.name}
                      control={form.control}
                      name={field.name}
                      label={field.label}
                      prefix={field.prefix}
                      hint={field.hint}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>ABM Uplifts & Programme Costs</CardTitle>
                  <CardDescription>
                    Uplifts apply to baseline metrics; cost entries power ROI, break-even and payback.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  {upliftFields.map((field) => (
                    <NumberField
                      key={field.name}
                      control={form.control}
                      name={field.name}
                      label={field.label}
                      hint={field.hint}
                    />
                  ))}

                  {costFields.map((field) => (
                    <NumberField
                      key={field.name}
                      control={form.control}
                      name={field.name}
                      label={field.label}
                      prefix={field.prefix}
                      hint={field.hint}
                    />
                  ))}
                </CardContent>
              </Card>
            </section>

            <aside className="flex flex-col gap-6 lg:gap-8">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Financial Snapshot</CardTitle>
                  <CardDescription>
                    Estimated incremental revenue, gross profit, ROI, break-even wins, and payback.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    <li className="flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">Incremental Revenue</span>
                      <span className="text-base font-medium text-foreground">
                        {formatCurrencyValue(
                          scenarioResult?.outputs.incremental.incrementalRevenue,
                        )}
                      </span>
                    </li>
                    <li className="flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">Incremental Gross Profit</span>
                      <span className="text-base font-medium text-foreground">
                        {formatCurrencyValue(
                          scenarioResult?.outputs.incremental.incrementalGrossProfit,
                        )}
                      </span>
                    </li>
                    <li className="flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">ROI</span>
                      <span className="text-base font-medium text-foreground">
                        {typeof scenarioResult?.outputs.incremental.roi === "number"
                          ? formatPercentValue(
                              scenarioResult.outputs.incremental.roi * 100,
                              1,
                            )
                          : "\u2014"}
                      </span>
                    </li>
                    <li className="flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">Break-even Wins</span>
                      <span className="text-base font-medium text-foreground">
                        {formatNumberValue(
                          scenarioResult?.outputs.incremental.breakEvenWins ?? null,
                          0,
                        )}
                      </span>
                    </li>
                    <li className="flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">Payback</span>
                      <span className="text-base font-medium text-foreground">
                        {scenarioResult?.outputs.incremental.paybackMonths
                          ? `${formatNumberValue(
                              scenarioResult.outputs.incremental.paybackMonths,
                            1,
                            )} months`
                          : "\u2014"}
                      </span>
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Metrics reflect validated inputs only. Errors in the form will show inline messages.
                    <br />
                    <br />
                    This is an estimate and is not a gurantee of performance.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Baseline vs ABM</CardTitle>
                  <CardDescription>
                    Compare funnel volumes and value uplift. Delta shows the absolute change between
                    scenarios.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[320px] text-sm">
                    <thead className="text-muted-foreground">
                      <tr className="text-left">
                        <th className="py-2">Metric</th>
                        <th className="py-2">Baseline</th>
                        <th className="py-2">With ABM</th>
                        <th className="py-2">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarioResult ? (
                        <>
                          <SummaryRow
                            label="Qualified opportunities"
                            baseline={formatNumberValue(
                              scenarioResult.outputs.baseline.qualifiedOpps,
                            )}
                            abm={formatNumberValue(scenarioResult.outputs.abm.qualifiedOpps)}
                            delta={formatNumberValue(
                              scenarioResult.outputs.abm.qualifiedOpps -
                                scenarioResult.outputs.baseline.qualifiedOpps,
                            )}
                          />
                          <SummaryRow
                            label="Expected wins"
                            baseline={formatNumberValue(
                              scenarioResult.outputs.baseline.expectedWins,
                            )}
                            abm={formatNumberValue(scenarioResult.outputs.abm.expectedWins)}
                            delta={formatNumberValue(
                              scenarioResult.outputs.abm.expectedWins -
                                scenarioResult.outputs.baseline.expectedWins,
                            )}
                          />
                          <SummaryRow
                            label="Revenue"
                            baseline={formatCurrencyValue(scenarioResult.outputs.baseline.revenue)}
                            abm={formatCurrencyValue(scenarioResult.outputs.abm.revenue)}
                            delta={formatCurrencyValue(
                              scenarioResult.outputs.abm.revenue -
                                scenarioResult.outputs.baseline.revenue,
                            )}
                          />
                          <SummaryRow
                            label="Gross profit"
                            baseline={formatCurrencyValue(
                              scenarioResult.outputs.baseline.grossProfit,
                            )}
                            abm={formatCurrencyValue(scenarioResult.outputs.abm.grossProfit)}
                            delta={formatCurrencyValue(
                              scenarioResult.outputs.abm.grossProfit -
                                scenarioResult.outputs.baseline.grossProfit,
                            )}
                          />
                        </>
                      ) : (
                        <tr>
                          <td className="py-3 text-muted-foreground" colSpan={4}>
                            Enter valid inputs to view calculations.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Sensitivity Grid</CardTitle>
                  <CardDescription>
                    ROI impact across in-market rate (rows) and win-rate uplift (columns).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {scenarioResult && sensitivityGrid ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[360px] border-collapse text-sm">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="py-2 pr-3 text-left">In-market % / Win uplift</th>
                            {scenarioResult.inputs.sensitivity.winRateUpliftRange.map((value) => (
                              <th key={value} className="py-2 px-3 text-right">
                                {formatPercentValue(value, 0)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sensitivityGrid.map((row, rowIndex) => (
                            <tr key={scenarioResult.inputs.sensitivity.inMarketRange[rowIndex]}>
                              <th className="py-2 pr-3 text-left font-medium text-foreground">
                                {formatPercentValue(
                                  scenarioResult.inputs.sensitivity.inMarketRange[rowIndex],
                                  0,
                                )}
                              </th>
                              {row.map((cell) => {
                                const roiPercent =
                                  cell.roi === null
                                    ? formatPercentValue(null, 1)
                                    : formatPercentValue(cell.roi * 100, 1);
                                const tone =
                                  typeof cell.roi === "number" && cell.roi >= 0
                                    ? "text-foreground"
                                    : "text-destructive";

                                return (
                                  <td key={`${cell.inMarketRate}-${cell.winRateUplift}`} className={`py-2 px-3 text-right font-medium ${tone}`}>
                                    {roiPercent}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                      Adjust inputs to generate a valid ROI matrix. Validation errors disable this view.
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Positive ROI values highlight in brand colours; negatives surface in destructive red for
                    quick risk assessment.
                  </p>
                </CardContent>
              </Card>
            </aside>
          </main>
          </div>
        </form>
      </Form>
    </TooltipProvider>
  );
}

type SummaryRowProps = {
  label: string;
  baseline: string;
  abm: string;
  delta: string;
};

function SummaryRow({ label, baseline, abm, delta }: SummaryRowProps) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2 pr-4 font-medium text-foreground">{label}</td>
      <td className="py-2 pr-4">{baseline}</td>
      <td className="py-2 pr-4">{abm}</td>
      <td className="py-2 font-medium text-cta">{delta}</td>
    </tr>
  );
}

function HintTooltip({ hint, label }: { hint?: string; label: string }) {
  if (!hint) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`${label} info`}
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="end">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

type NumberFieldProps<Name extends FieldPath<ScenarioInputSchema>> = {
  control: Control<ScenarioInputSchema>;
  name: Name;
  label: string;
  prefix?: string;
  hint?: string;
};

function NumberField<Name extends FieldPath<ScenarioInputSchema>>({
  control,
  name,
  label,
  prefix,
  hint,
}: NumberFieldProps<Name>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between gap-2">
            <FormLabel>{label}</FormLabel>
            <HintTooltip hint={hint} label={label} />
          </div>
          <FormControl>
            <div className="relative">
              {prefix ? (
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                  {prefix}
                </span>
              ) : null}
              <Input
                inputMode="decimal"
                value={field.value === undefined ? "" : String(field.value)}
                onChange={(event) =>
                  field.onChange(numberParser(event.target.value))
                }
                className={prefix ? "pl-7" : undefined}
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
