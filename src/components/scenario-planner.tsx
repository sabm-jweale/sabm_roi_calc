"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm, type Control, type FieldPath, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";

import { SliderWithBenchmark } from "@/components/slider-with-benchmark";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import type { SensitivityCell } from "@/lib/calculator/types";

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

const LOCALE_OPTIONS = [
  { value: "en-GB", label: "English (UK)" },
  { value: "en-US", label: "English (US)" },
  { value: "de-DE", label: "German (EU)" },
] as const;

type Mode = "setup" | "tune" | "present";
type SetupStep = "programme" | "market" | "budget";
type TierKey = "oneToOne" | "oneToFew" | "oneToMany";
type PresetKey = "conservative" | "expected" | "stretch";

type StepConfig = {
  id: SetupStep;
  title: string;
  description: string;
};

const SETUP_STEPS: StepConfig[] = [
  {
    id: "programme",
    title: "Programme",
    description: "Pick tier and duration to frame the plan.",
  },
  {
    id: "market",
    title: "Market & baseline",
    description: "Who you target and what success looks like today.",
  },
  {
    id: "budget",
    title: "Budget & capacity",
    description: "Investment and team coverage assumptions.",
  },
];

const TIER_CONFIG: Record<
  TierKey,
  {
    label: string;
    helper: string;
    defaultAccounts: number;
    defaultQualifiedOpps: number;
  }
> = {
  oneToOne: {
    label: "Single_account (1:1)",
    helper: "High touch, 3-5 accounts. Expect deeper personalization.",
    defaultAccounts: 4,
    defaultQualifiedOpps: 1.2,
  },
  oneToFew: {
    label: "Clustered (1:few)",
    helper: "Clustered pods, 10–25 accounts. Balanced scale vs depth.",
    defaultAccounts: 20,
    defaultQualifiedOpps: 0.6,
  },
  oneToMany: {
    label: "Programmatic (1:many)",
    helper: "At-scale motions, 100+ accounts. Efficiency matters.",
    defaultAccounts: 100,
    defaultQualifiedOpps: 0.4,
  },
};

const PRESET_CONFIG: Record<
  PresetKey,
  {
    label: string;
    helper: string;
    uplifts: {
      winRateUplift: number;
      acvUplift: number;
      opportunityRateUplift: number;
    };
    inMarketRate?: number;
  }
> = {
  conservative: {
    label: "Conservative",
    helper: "Nail the baseline story with defensible gains.",
    uplifts: {
      winRateUplift: 4,
      acvUplift: 6,
      opportunityRateUplift: 10,
    },
    inMarketRate: 25,
  },
  expected: {
    label: "Expected",
    helper: "Use the mid-case RE models we see most often.",
    uplifts: {
      winRateUplift: 8,
      acvUplift: 15,
      opportunityRateUplift: 20,
    },
    inMarketRate: 35,
  },
  stretch: {
    label: "Stretch",
    helper: "Push for upside, but pressure-test the evidence.",
    uplifts: {
      winRateUplift: 12,
      acvUplift: 25,
      opportunityRateUplift: 35,
    },
    inMarketRate: 45,
  },
};

const setupValidationMap: Record<SetupStep, Array<FieldPath<ScenarioInputSchema>>> = {
  programme: ["programme.durationMonths"],
  market: [
    "market.targetAccounts",
    "market.inMarketRate",
    "market.baselineWinRate",
    "market.baselineAcv",
  ],
  budget: [
    "costs.people",
    "costs.media",
    "costs.dataTech",
    "costs.content",
    "costs.agency",
    "costs.other",
  ],
};

export function ScenarioPlanner() {
  // Fix zodResolver type inference issue by casting to proper resolver type
  const resolver = zodResolver(scenarioSchema) as Resolver<ScenarioInputSchema>;

  const form = useForm<ScenarioInputSchema>({
    resolver,
    defaultValues: DEFAULT_SCENARIO,
    mode: "onChange",
  });

  const [mode, setMode] = useState<Mode>("setup");
  const [setupStep, setSetupStep] = useState<SetupStep>("programme");
  const [tier, setTier] = useState<TierKey>("oneToFew");
  const [preset, setPreset] = useState<PresetKey>("expected");
  const [showCoach, setShowCoach] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const seen = window.localStorage.getItem("sabm-roi-coach");
    if (!seen) {
      setShowCoach(true);
    }
  }, []);

  const dismissCoach = () => {
    setShowCoach(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sabm-roi-coach", "1");
    }
  };

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
        resolution:
          watchedInputs.sensitivity?.resolution ??
          DEFAULT_SCENARIO.sensitivity.resolution,
      },
    } satisfies ScenarioInputSchema;
  }, [watchedInputs]);

  useEffect(() => {
    const tierDefaults = TIER_CONFIG[tier];
    form.setValue("market.targetAccounts", tierDefaults.defaultAccounts, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue(
      "market.qualifiedOppsPerAccount",
      tierDefaults.defaultQualifiedOpps,
      {
        shouldValidate: true,
        shouldDirty: true,
      },
    );
  }, [tier, form]);

  useEffect(() => {
    const presetDefaults = PRESET_CONFIG[preset];
    form.setValue("uplifts.winRateUplift", presetDefaults.uplifts.winRateUplift, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue("uplifts.acvUplift", presetDefaults.uplifts.acvUplift, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue(
      "uplifts.opportunityRateUplift",
      presetDefaults.uplifts.opportunityRateUplift,
      {
        shouldValidate: true,
        shouldDirty: true,
      },
    );
    if (presetDefaults.inMarketRate !== undefined) {
      form.setValue("market.inMarketRate", presetDefaults.inMarketRate, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [preset, form]);

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

  const totalCost = useMemo(() => {
    const costs = sanitizedInputs.costs;
    return (
      costs.people +
      costs.media +
      costs.dataTech +
      costs.content +
      costs.agency +
      costs.other
    );
  }, [sanitizedInputs.costs]);

  const treatedAccounts = useMemo(() => {
    const accounts = sanitizedInputs.market.targetAccounts;
    const inMarketShare = sanitizedInputs.market.inMarketRate / 100;
    return Math.round(accounts * inMarketShare);
  }, [sanitizedInputs.market.targetAccounts, sanitizedInputs.market.inMarketRate]);

  const intensityMultiplier = useMemo(() => {
    const opportunityLift = sanitizedInputs.uplifts.opportunityRateUplift / 100;
    const winLift = sanitizedInputs.uplifts.winRateUplift / 100;
    const treatedShare = sanitizedInputs.market.inMarketRate / 100;
    const base = treatedShare * (1 + opportunityLift / 2 + winLift / 4);
    return Number.isFinite(base) ? Math.max(0, base) : 0;
  }, [
    sanitizedInputs.market.inMarketRate,
    sanitizedInputs.uplifts.opportunityRateUplift,
    sanitizedInputs.uplifts.winRateUplift,
  ]);

  const dilutionRisk = intensityMultiplier > 0.75 && sanitizedInputs.market.targetAccounts > 120;

  const handleTotalCostChange = (value: number) => {
    if (Number.isNaN(value) || value < 0) {
      return;
    }

    const current = form.getValues("costs");
    const currentTotal =
      current.people +
      current.media +
      current.dataTech +
      current.content +
      current.agency +
      current.other;

    if (currentTotal <= 0) {
      form.setValue("costs.people", value, { shouldDirty: true, shouldValidate: true });
      form.setValue("costs.media", 0, { shouldDirty: true, shouldValidate: true });
      form.setValue("costs.dataTech", 0, { shouldDirty: true, shouldValidate: true });
      form.setValue("costs.content", 0, { shouldDirty: true, shouldValidate: true });
      form.setValue("costs.agency", 0, { shouldDirty: true, shouldValidate: true });
      form.setValue("costs.other", 0, { shouldDirty: true, shouldValidate: true });
      return;
    }

    const ratio = value / currentTotal;
    const keys = Object.keys(current) as Array<keyof typeof current>;
    const next: Partial<typeof current> = {};
    let runningTotal = 0;

    keys.forEach((key, index) => {
      let scaled = Math.max(0, Math.round(current[key] * ratio));
      if (index === keys.length - 1) {
        const diff = value - (runningTotal + scaled);
        scaled = Math.max(0, scaled + diff);
      }
      runningTotal += scaled;
      next[key] = scaled;
    });

    keys.forEach((key) => {
      form.setValue(`costs.${key}` as const, next[key] ?? 0, {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
  };

  const goToNextStep = async () => {
    const fields = setupValidationMap[setupStep];
    const valid = await form.trigger(fields, {
      shouldFocus: true,
    });

    if (!valid) {
      return;
    }

    if (setupStep === "budget") {
      setMode("tune");
      setSetupStep("programme");
      return;
    }

    setSetupStep((current) => {
      if (current === "programme") {
        return "market";
      }

      if (current === "market") {
        return "budget";
      }

      return current;
    });
  };

  const goToPreviousStep = () => {
    setSetupStep((current) => {
      if (current === "budget") {
        return "market";
      }

      if (current === "market") {
        return "programme";
      }

      return current;
    });
  };

  const setupComplete = scenarioResult !== null;

  return (
    <TooltipProvider delayDuration={200}>
      <Form {...form}>
        <form className="min-h-dvh bg-background" noValidate>
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:px-10">
            <header className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="space-y-3">
                <Image
                  src="/img/strategicabm_logoforwhitebg_web.jpg"
                  alt="strategicabm wordmark"
                  width={240}
                  height={60}
                  priority
                  className="h-auto w-48 sm:w-60"
                />
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
                    ABM ROI Studio
                  </h1>
                  <p className="max-w-2xl text-base text-muted-foreground">
                    Move from inputs to a board-ready ABM business case in three focused steps: set up, tune, and present.
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                className="self-start bg-cta text-white hover:bg-cta/90"
                disabled={!setupComplete}
              >
                Export (coming soon)
              </Button>
            </header>

            <nav className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-2 text-sm font-medium">
              {(["setup", "tune", "present"] as Mode[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setMode(tab)}
                  className={`rounded-md px-3 py-2 transition ${
                    mode === tab
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "setup" ? "Setup" : tab === "tune" ? "Tune" : "Present"}
                </button>
              ))}
            </nav>

            {mode === "setup" ? (
              <section className="space-y-6">
                {showCoach ? (
                  <Card className="border-dashed bg-muted/40">
                    <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
                      <p>
                        Welcome in. You&apos;ll glide through three short steps. We&apos;ll only ask for the essentials now; deeper controls live under Advanced.
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button size="sm" onClick={dismissCoach}>
                          Let&apos;s start
                        </Button>
                        <p className="text-xs text-muted-foreground/80">
                          We&apos;ll remember this on next visit.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {SETUP_STEPS.map((step, index) => {
                      const active = setupStep === step.id;
                      const completed = SETUP_STEPS.findIndex((s) => s.id === setupStep) > index;

                      return (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => setSetupStep(step.id)}
                          className={`flex grow basis-32 flex-col rounded-lg border px-3 py-2 text-left transition ${
                            active
                              ? "border-cta/80 bg-background shadow-sm"
                              : completed
                                ? "border-border bg-muted/40"
                                : "border-border/60 bg-muted/20 hover:bg-muted/30"
                          }`}
                        >
                          <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Step {index + 1}
                            {completed ? <span className="text-cta">Done</span> : null}
                          </span>
                          <span className="mt-1 text-sm font-medium text-foreground">
                            {step.title}
                          </span>
                          <span className="mt-1 text-xs text-muted-foreground">
                            {step.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <Card className="shadow-sm">
                    <CardHeader className="space-y-1">
                      <CardTitle className="text-xl">
                        {SETUP_STEPS.find((step) => step.id === setupStep)?.title}
                      </CardTitle>
                      <CardDescription>
                        {SETUP_STEPS.find((step) => step.id === setupStep)?.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {setupStep === "programme" ? (
                        <ProgrammeStep
                          control={form.control}
                          onSelectTier={setTier}
                          selectedTier={tier}
                          onSelectPreset={setPreset}
                          selectedPreset={preset}
                        />
                      ) : null}

                      {setupStep === "market" ? (
                        <MarketStep control={form.control} tier={tier} />
                      ) : null}

                      {setupStep === "budget" ? (
                        <BudgetStep
                          control={form.control}
                          totalCost={totalCost}
                          onTotalCostChange={handleTotalCostChange}
                        />
                      ) : null}

                      <div className="flex items-center justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={goToPreviousStep}
                          disabled={setupStep === "programme"}
                        >
                          Back
                        </Button>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={() => setMode("tune")}>Skip to tune</Button>
                          <Button type="button" onClick={goToNextStep}>
                            {setupStep === "budget" ? "Finish setup" : "Continue"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>
            ) : null}

            {mode === "tune" ? (
              <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:gap-8">
                <div className="space-y-6">
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle>Impact uplifts</CardTitle>
                      <CardDescription>
                        Adjust the levers that ABM influences most. Numbers update instantly.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <SliderWithBenchmark
                        label="Win-rate uplift (pp)"
                        value={sanitizedInputs.uplifts.winRateUplift}
                        onChange={(value) =>
                          form.setValue("uplifts.winRateUplift", value, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        min={0}
                        max={20}
                        baseMin={2}
                        baseMax={8}
                        stretchMin={10}
                        stretchMax={15}
                        unit="pp"
                        description="Above stretch? Trim treated accounts or capture proof points in the assumptions deck."
                      />
                      <SliderWithBenchmark
                        label="ACV uplift (%)"
                        value={sanitizedInputs.uplifts.acvUplift}
                        onChange={(value) =>
                          form.setValue("uplifts.acvUplift", value, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        min={-30}
                        max={100}
                        baseMin={5}
                        baseMax={18}
                        stretchMin={20}
                        stretchMax={35}
                        unit="%"
                      />
                      <SliderWithBenchmark
                        label="Opportunity uplift (%)"
                        value={sanitizedInputs.uplifts.opportunityRateUplift}
                        onChange={(value) =>
                          form.setValue("uplifts.opportunityRateUplift", value, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        min={0}
                        max={100}
                        baseMin={10}
                        baseMax={25}
                        stretchMin={30}
                        stretchMax={45}
                        unit="%"
                      />
                      <SliderWithBenchmark
                        label="In-market rate (%)"
                        value={sanitizedInputs.market.inMarketRate}
                        onChange={(value) =>
                          form.setValue("market.inMarketRate", value, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        min={0}
                        max={70}
                        baseMin={20}
                        baseMax={40}
                        stretchMin={40}
                        stretchMax={55}
                        unit="%"
                        description="Anchor this to intent data or historical opportunity scans."
                      />
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>Coverage & intensity</CardTitle>
                        <CardDescription>
                          We translate your numbers into plain English coverage cues.
                        </CardDescription>
                      </div>
                      <Badge variant={dilutionRisk ? "destructive" : "default"}>
                        {dilutionRisk ? "Dilution risk" : "Balanced"}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <CoverageMetric
                          label="Treated accounts"
                          value={`${treatedAccounts}`}
                          helper={`of ${sanitizedInputs.market.targetAccounts} target accounts`}
                        />
                        <CoverageMetric
                          label="Intensity multiplier"
                          value={`${intensityMultiplier.toFixed(2)}×`}
                          helper="Higher than 0.8× may stretch team bandwidth."
                        />
                        <CoverageMetric
                          label="Programme duration"
                          value={`${sanitizedInputs.programme.durationMonths} months`}
                          helper={`${sanitizedInputs.programme.rampMonths} month ramp included.`}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {totalCost > 0
                          ? `At current budget you can fully treat ${Math.max(
                              1,
                              Math.round(treatedAccounts * (intensityMultiplier || 0.1)),
                            )} accounts with an effective uplift of ${(intensityMultiplier * 100).toFixed(0)}%.`
                          : "Add investment numbers to size feasible coverage."}
                      </p>
                    </CardContent>
                  </Card>

                  <AdvancedBlock title="Sensitivity (advanced)">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="sensitivity.inMarketRange"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>In-market range (%)</FormLabel>
                            <FormControl>
                              <Input
                                value={(field.value ?? []).join(", ")}
                                onChange={(event) =>
                                  field.onChange(
                                    event.target.value
                                      .split(",")
                                      .map((token) => Number(token.trim()))
                                      .filter((token) => !Number.isNaN(token)),
                                  )
                                }
                                placeholder="e.g. 25, 35, 45"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sensitivity.winRateUpliftRange"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Win uplift range (pp)</FormLabel>
                            <FormControl>
                              <Input
                                value={(field.value ?? []).join(", ")}
                                onChange={(event) =>
                                  field.onChange(
                                    event.target.value
                                      .split(",")
                                      .map((token) => Number(token.trim()))
                                      .filter((token) => !Number.isNaN(token)),
                                  )
                                }
                                placeholder="e.g. 5, 10, 15"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </AdvancedBlock>
                </div>

                <aside className="space-y-6">
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle>Headline KPIs</CardTitle>
                      <CardDescription>The numbers leadership jumps to first.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <KpiTile
                        label="ROI"
                        value={
                          typeof scenarioResult?.outputs.incremental.roi === "number"
                            ? formatPercentValue(scenarioResult.outputs.incremental.roi * 100, 1)
                            : "—"
                        }
                        tone={scenarioResult?.outputs.incremental.roi ?? 0 >= 0 ? "positive" : "neutral"}
                      />
                      <KpiTile
                        label="Payback"
                        value={formatNumberValue(
                          scenarioResult?.outputs.incremental.paybackMonths,
                          1,
                        )}
                        helper="months"
                      />
                      <KpiTile
                        label="Incremental gross profit"
                        value={formatCurrencyValue(
                          scenarioResult?.outputs.incremental.incrementalGrossProfit,
                        )}
                      />
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle>Notes</CardTitle>
                      <CardDescription>
                        Surface assumptions that need validation before presenting.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        {dilutionRisk
                          ? "You&apos;re above typical stretch for win-rate uplift—consider fewer accounts or dial up supporting evidence."
                          : "Solid balance of coverage and impact. Log proof points for leadership review."}
                      </p>
                      <p>
                        {totalCost === 0
                          ? "Add programme investment so ROI reflects reality."
                          : `Total investment captured: ${formatCurrencyValue(totalCost)}.`}
                      </p>
                    </CardContent>
                  </Card>
                </aside>
              </section>
            ) : null}

            {mode === "present" ? (
              <section className="space-y-6">
                {scenarioResult ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <KpiTile
                        label="Net ROI"
                        value={
                          typeof scenarioResult.outputs.incremental.roi === "number"
                            ? formatPercentValue(
                                scenarioResult.outputs.incremental.roi * 100,
                                1,
                              )
                            : "—"
                        }
                        tone={scenarioResult.outputs.incremental.roi ?? 0 >= 0 ? "positive" : "neutral"}
                      />
                      <KpiTile
                        label="Payback"
                        value={formatNumberValue(
                          scenarioResult.outputs.incremental.paybackMonths,
                          1,
                        )}
                        helper="months"
                      />
                      <KpiTile
                        label="Incremental gross profit"
                        value={formatCurrencyValue(
                          scenarioResult.outputs.incremental.incrementalGrossProfit,
                        )}
                      />
                    </div>
                    <Card className="shadow-sm">
                      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle>Scoreboard snapshot</CardTitle>
                          <CardDescription>Baseline vs ABM in plain view.</CardDescription>
                        </div>
                        <Button variant="outline" onClick={() => setShowDetails(true)}>
                          View details
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <table className="w-full text-sm">
                          <thead className="text-left text-muted-foreground">
                            <tr>
                              <th className="py-2 pr-4 font-medium">Metric</th>
                              <th className="py-2 pr-4 font-medium">Baseline</th>
                              <th className="py-2 pr-4 font-medium">ABM</th>
                              <th className="py-2 font-medium">Δ</th>
                            </tr>
                          </thead>
                          <tbody>
                            <SummaryRow
                              label="Revenue"
                              baseline={formatCurrencyValue(
                                scenarioResult.outputs.baseline.revenue,
                              )}
                              abm={formatCurrencyValue(
                                scenarioResult.outputs.abm.revenue,
                              )}
                              delta={formatCurrencyValue(
                                scenarioResult.outputs.incremental.incrementalRevenue,
                              )}
                            />
                            <SummaryRow
                              label="Gross profit"
                              baseline={formatCurrencyValue(
                                scenarioResult.outputs.baseline.grossProfit,
                              )}
                              abm={formatCurrencyValue(
                                scenarioResult.outputs.abm.grossProfit,
                              )}
                              delta={formatCurrencyValue(
                                scenarioResult.outputs.incremental.incrementalGrossProfit,
                              )}
                            />
                            <SummaryRow
                              label="Wins"
                              baseline={formatNumberValue(
                                scenarioResult.outputs.baseline.expectedWins,
                                0,
                              )}
                              abm={formatNumberValue(
                                scenarioResult.outputs.abm.expectedWins,
                                0,
                              )}
                              delta={formatNumberValue(
                                scenarioResult.outputs.abm.expectedWins -
                                  scenarioResult.outputs.baseline.expectedWins,
                                0,
                              )}
                            />
                          </tbody>
                        </table>
                        <p className="text-xs text-muted-foreground">
                          Need more depth? Open the drawer for the full variance view and sensitivity heatmap.
                        </p>
                      </CardContent>
                    </Card>
 
                  </>
                ) : (
                  <Card className="border-dashed bg-muted/30 text-center">
                    <CardContent className="space-y-3 py-10 text-sm text-muted-foreground">
                      <p>Complete setup and tune inputs to generate the scoreboard.</p>
                      <Button variant="outline" onClick={() => setMode("setup")}>Back to step 1</Button>
                    </CardContent>
                  </Card>
                )}
              </section>
            ) : null}
          </div>
        </form>
      </Form>

      {showDetails && scenarioResult ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowDetails(false)}
            aria-label="Close details"
          />
          <div className="ml-auto flex h-full w-full max-w-3xl flex-col bg-background shadow-xl">
            <header className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">Programme detail</h2>
                <p className="text-sm text-muted-foreground">
                  Baseline vs ABM breakdown and ROI sensitivity grid.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setShowDetails(false)}>
                Close
              </Button>
            </header>
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Conversion summary
                </h3>
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Metric</th>
                      <th className="py-2 pr-4 font-medium">Baseline</th>
                      <th className="py-2 pr-4 font-medium">ABM</th>
                      <th className="py-2 font-medium">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SummaryRow
                      label="Opportunities"
                      baseline={formatNumberValue(
                        scenarioResult.outputs.baseline.qualifiedOpps,
                        1,
                      )}
                      abm={formatNumberValue(
                        scenarioResult.outputs.abm.qualifiedOpps,
                        1,
                      )}
                      delta={formatNumberValue(
                        scenarioResult.outputs.abm.qualifiedOpps -
                          scenarioResult.outputs.baseline.qualifiedOpps,
                        1,
                      )}
                    />
                    <SummaryRow
                      label="Revenue"
                      baseline={formatCurrencyValue(
                        scenarioResult.outputs.baseline.revenue,
                      )}
                      abm={formatCurrencyValue(
                        scenarioResult.outputs.abm.revenue,
                      )}
                      delta={formatCurrencyValue(
                        scenarioResult.outputs.incremental.incrementalRevenue,
                      )}
                    />
                    <SummaryRow
                      label="Gross profit"
                      baseline={formatCurrencyValue(
                        scenarioResult.outputs.baseline.grossProfit,
                      )}
                      abm={formatCurrencyValue(
                        scenarioResult.outputs.abm.grossProfit,
                      )}
                      delta={formatCurrencyValue(
                        scenarioResult.outputs.incremental.incrementalGrossProfit,
                      )}
                    />
                    <SummaryRow
                      label="ROI"
                      baseline={"—"}
                      abm={"—"}
                      delta={
                        typeof scenarioResult.outputs.incremental.roi === "number"
                          ? formatPercentValue(
                              scenarioResult.outputs.incremental.roi * 100,
                              1,
                            )
                          : "—"
                      }
                    />
                  </tbody>
                </table>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  ROI sensitivity
                </h3>
                {sensitivityGrid ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left text-muted-foreground">In-market %</th>
                          {scenarioResult.inputs.sensitivity.winRateUpliftRange.map((column: number) => (
                            <th key={column} className="px-3 py-2 text-right text-muted-foreground">
                              {column}% uplift
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scenarioResult.inputs.sensitivity.inMarketRange.map((inMarketRate: number, rowIdx: number) => (
                          <tr key={inMarketRate} className="odd:bg-background even:bg-muted/20">
                            <td className="px-3 py-2 text-left text-muted-foreground">
                              {inMarketRate}%
                            </td>
                            {scenarioResult.inputs.sensitivity.winRateUpliftRange.map((_, colIdx: number) => {
                              const cell: SensitivityCell | undefined = sensitivityGrid?.[rowIdx]?.[colIdx];
                              const roiPercent =
                                !cell || cell.roi === null
                                  ? formatPercentValue(null, 1)
                                  : formatPercentValue(cell.roi * 100, 1);
                              const tone =
                                cell && typeof cell.roi === "number" && cell.roi >= 0
                                  ? "text-foreground"
                                  : "text-destructive";

                              return (
                                <td
                                  key={`${inMarketRate}-${colIdx}`}
                                  className={`px-3 py-2 text-right font-medium ${tone}`}
                                >
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
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </TooltipProvider>
  );
}

type ProgrammeStepProps = {
  control: Control<ScenarioInputSchema>;
  onSelectTier: (tier: TierKey) => void;
  selectedTier: TierKey;
  onSelectPreset: (preset: PresetKey) => void;
  selectedPreset: PresetKey;
};

function ProgrammeStep({
  control,
  onSelectTier,
  selectedTier,
  onSelectPreset,
  selectedPreset,
}: ProgrammeStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-1 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tier presets
          </span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TIER_CONFIG) as TierKey[]).map((tier) => {
              const config = TIER_CONFIG[tier];
              const active = tier === selectedTier;

              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => onSelectTier(tier)}
                  className={`rounded-md border px-3 py-2 text-left transition ${
                    active
                      ? "border-cta bg-background shadow-sm"
                      : "border-border bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {config.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{config.helper}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quick presets
          </span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PRESET_CONFIG) as PresetKey[]).map((key) => {
              const config = PRESET_CONFIG[key];
              const active = key === selectedPreset;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectPreset(key)}
                  className={`rounded-md border px-3 py-2 text-left transition ${
                    active
                      ? "border-cta bg-background shadow-sm"
                      : "border-border bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {config.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{config.helper}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <NumberField
          control={control}
          name="programme.durationMonths"
          label="Programme duration (months)"
          hint="Total length of the planned ABM programme, including ramp."
        />
        <NumberField
          control={control}
          name="programme.rampMonths"
          label="Ramp-up period (months)"
          hint="How quickly the programme reaches steady-state performance."
        />
      </div>

      <AdvancedBlock title="Formatting (advanced)">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="programme.currency"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel>Currency</FormLabel>
                  <HintTooltip hint="Currency used across all outputs and exports." label="Currency" />
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
            control={control}
            name="programme.numberFormatLocale"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel>Number formatting</FormLabel>
                  <HintTooltip
                    hint="Locale controls thousand separators and decimal punctuation."
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
        </div>
      </AdvancedBlock>
    </div>
  );
}

type MarketStepProps = {
  control: Control<ScenarioInputSchema>;
  tier: TierKey;
};

function MarketStep({ control, tier }: MarketStepProps) {
  const tierNote = TIER_CONFIG[tier];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          {tierNote.label} preset loaded: at current budget you can fully treat {tierNote.defaultAccounts} accounts. Tweak the numbers below to reflect your market.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <NumberField
          control={control}
          name="market.targetAccounts"
          label="Target accounts"
          hint="Total accounts in scope for this ABM programme."
        />
        <NumberField
          control={control}
          name="market.inMarketRate"
          label="In-market rate (%)"
          hint="% of target accounts currently in-market or with active demand."
        />
        <NumberField
          control={control}
          name="market.baselineWinRate"
          label="Baseline win rate (%)"
          hint="Historical close rate without ABM influence."
        />
        <NumberField
          control={control}
          name="market.baselineAcv"
          label="Baseline ACV"
          prefix="£"
          hint="Average contract value per deal before ABM uplift."
        />
      </div>

      <AdvancedBlock title="Baseline depth (advanced)">
        <div className="grid gap-6 sm:grid-cols-2">
          <NumberField
            control={control}
            name="market.contributionMargin"
            label="Contribution margin (%)"
            hint="Gross margin expected on recognised revenue."
          />
          <NumberField
            control={control}
            name="market.salesCycleMonthsBaseline"
            label="Sales cycle (baseline months)"
            hint="Typical time to close a deal today, in months."
          />
          <NumberField
            control={control}
            name="market.salesCycleMonthsAbm"
            label="Sales cycle (ABM months)"
            hint="Expected time to close when ABM is in-market."
          />
        </div>
      </AdvancedBlock>
    </div>
  );
}

type BudgetStepProps = {
  control: Control<ScenarioInputSchema>;
  totalCost: number;
  onTotalCostChange: (value: number) => void;
};

function BudgetStep({ control, totalCost, onTotalCostChange }: BudgetStepProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Total programme investment
          </label>
          <Input
            value={totalCost}
            onChange={(event) => onTotalCostChange(Number(event.target.value))}
            inputMode="decimal"
            className="text-base"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Enter the blended annual budget. You can split it out in Advanced.
          </p>
        </div>
        <NumberField
          control={control}
          name="market.qualifiedOppsPerAccount"
          label="Qualified opps per in-market account"
          hint="Keeps the delivery team honest on capacity."
        />
      </div>

      <AdvancedBlock title="Cost breakdown (advanced)">
        <div className="grid gap-6 sm:grid-cols-2">
          <NumberField
            control={control}
            name="costs.people"
            label="People"
            prefix="£"
            hint="Internal headcount cost attributed to the programme."
          />
          <NumberField
            control={control}
            name="costs.media"
            label="Media"
            prefix="£"
            hint="Paid media budget dedicated to ABM tactics."
          />
          <NumberField
            control={control}
            name="costs.dataTech"
            label="Data & tech"
            prefix="£"
            hint="Platforms, intent data, enrichment, and tooling costs."
          />
          <NumberField
            control={control}
            name="costs.content"
            label="Content"
            prefix="£"
            hint="Content creation, personalization, and asset production spend."
          />
          <NumberField
            control={control}
            name="costs.agency"
            label="Agency & partners"
            prefix="£"
            hint="External partner and agency fees supporting the programme."
          />
          <NumberField
            control={control}
            name="costs.other"
            label="Other"
            prefix="£"
            hint="Any additional investments not captured above."
          />
        </div>
      </AdvancedBlock>
    </div>
  );
}

type CoverageMetricProps = {
  label: string;
  value: string;
  helper: string;
};

function CoverageMetric({ label, value, helper }: CoverageMetricProps) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

type KpiTileProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: "positive" | "neutral";
};

function KpiTile({ label, value, helper, tone = "neutral" }: KpiTileProps) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "neutral"
        ? "text-foreground"
        : "text-destructive";

  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

type AdvancedBlockProps = {
  title: string;
  children: ReactNode;
};

function AdvancedBlock({ title, children }: AdvancedBlockProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-dashed bg-muted/10 p-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground"
      >
        <span>{title}</span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="mt-4 space-y-4">{children}</div> : null}
    </div>
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
                onChange={(event) => field.onChange(numberParser(event.target.value))}
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
