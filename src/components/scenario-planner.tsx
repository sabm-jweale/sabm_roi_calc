"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
  type ReactNode,
} from "react";
import {
  useForm,
  type Control,
  type FieldNamesMarkedBoolean,
  type FieldPath,
  type Resolver,
} from "react-hook-form";
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
  ALIGNMENT_MULTIPLIERS,
  deriveCoverage,
  deriveIntensity,
} from "@/lib/calculator/capacity";
import type { CapacityBottleneck } from "@/lib/calculator/capacity";
import type { AlignmentLevel } from "@/lib/calculator/types";
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
import { deriveInMarketPct } from "@/lib/in-market";
import { cn } from "@/lib/utils";
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
type CyclePresetKey = "typical" | "stretch";

type StepConfig = {
  id: SetupStep;
  title: string;
  description: string;
};

type CoachStepConfig = {
  id: string;
  title: string;
  description: string;
  target: RefObject<HTMLElement | null>;
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
    description: "Who you target and your current baseline today.",
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
  }
> = {
  oneToOne: {
    label: "Single Account (1:1)",
    helper: "High touch, 3-5 accounts. Expect deeper personalization.",
    defaultAccounts: 4,
  },
  oneToFew: {
    label: "Clustered (1:few)",
    helper: "Clustered pods, 10–25 accounts. Balanced scale vs depth.",
    defaultAccounts: 20,
  },
  oneToMany: {
    label: "Programmatic (1:many)",
    helper: "At-scale motions, 100+ accounts. Efficiency matters.",
    defaultAccounts: 100,
  },
};

const TIER_KEYS: readonly TierKey[] = ["oneToOne", "oneToFew", "oneToMany"] as const;

const deriveInitialTier = (accounts: number): TierKey => {
  if (!Number.isFinite(accounts)) {
    return "oneToFew";
  }

  let selected: TierKey = "oneToFew";
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const key of TIER_KEYS) {
    const diff = Math.abs(TIER_CONFIG[key].defaultAccounts - accounts);
    if (diff < bestDelta) {
      bestDelta = diff;
      selected = key;
    }
  }

  return selected;
};

const DEFAULT_TIER = deriveInitialTier(DEFAULT_SCENARIO.market.targetAccounts);

const PRESET_CONFIG: Record<
  PresetKey,
  {
    label: string;
    helper: string;
    upliftMultipliers: {
      winRate: number;
      acv: number;
      opportunity: number;
    };
    inMarketMultiplier?: number;
  }
> = {
  conservative: {
    label: "Conservative",
    helper: "Building your first ABM programme? Start here.",
    upliftMultipliers: {
      winRate: 0.5,
      acv: 0.4,
      opportunity: 0.5,
    },
    inMarketMultiplier: 0.67,
  },
  expected: {
    label: "Expected",
    helper: "Got some ABM experience and ready to get started.",
    upliftMultipliers: {
      winRate: 1,
      acv: 1,
      opportunity: 1,
    },
    inMarketMultiplier: 1,
  },
  stretch: {
    label: "Stretch",
    helper: "Been running established ABM programmes with reliable success? Push for upside.",
    upliftMultipliers: {
      winRate: 1.5,
      acv: 1.6666666666666667,
      opportunity: 1.75,
    },
    inMarketMultiplier: 1.33,
  },
};

const DEFAULT_POINT_IN_TIME_SHARE = 0.05;
const BUYING_WINDOW_OPTIONS = [2, 3, 4, 6] as const;
const DEFAULT_BUYING_WINDOW_MONTHS: Record<TierKey, number> = {
  oneToOne: 3,
  oneToFew: 3,
  oneToMany: 2,
};

const IN_MARKET_SLIDER_BOUNDS = {
  min: 5,
  max: 35,
  baseMin: 15,
  baseMax: 20,
  stretchMin: 22,
  stretchMax: 28,
};

const TIER_CYCLE_REDUCTION: Record<
  TierKey,
  { typical: number; stretch: number }
> = {
  oneToOne: { typical: 0.2, stretch: 0.35 },
  oneToFew: { typical: 0.15, stretch: 0.25 },
  oneToMany: { typical: 0.1, stretch: 0.2 },
};

const TEAM_HOURS_PER_ACCOUNT: Record<TierKey, number> = {
  oneToOne: 32,
  oneToFew: 12,
  oneToMany: 3,
};

const BUDGET_PER_ACCOUNT_ESTIMATE: Record<TierKey, number> = {
  oneToOne: 60000,
  oneToFew: 23500,
  oneToMany: 6000,
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
    "capacity.source",
    "capacity.marketingFte",
    "capacity.salesFte",
    "capacity.marketingUtilisation",
    "capacity.salesUtilisation",
    "capacity.hoursPerAccount",
    "alignment.level",
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
  const { dirtyFields } = form.formState;

  const [mode, setMode] = useState<Mode>("setup");
  const [setupStep, setSetupStep] = useState<SetupStep>("programme");
  const [tier, setTier] = useState<TierKey>(() => DEFAULT_TIER);
  const [preset, setPreset] = useState<PresetKey>("expected");
  const [cyclePreset, setCyclePreset] = useState<CyclePresetKey>("typical");
  const [cycleOverrideEnabled, setCycleOverrideEnabled] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [coachStep, setCoachStep] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showBaselineComparison, setShowBaselineComparison] = useState(false);
  const [inMarketAuto, setInMarketAuto] = useState(true);
  const [buyingWindowMonths, setBuyingWindowMonths] = useState(
    () => DEFAULT_BUYING_WINDOW_MONTHS[DEFAULT_TIER],
  );
  const [customBuyingWindow, setCustomBuyingWindow] = useState(false);
  const [flatBudget, setFlatBudget] = useState(0);

  const modeNavRef = useRef<HTMLDivElement | null>(null);
  const setupStepsRef = useRef<HTMLDivElement | null>(null);
  const presetRef = useRef<HTMLDivElement | null>(null);
  const setupActionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const seen = window.localStorage.getItem("sabm-roi-coach");
    if (!seen) {
      setCoachStep(0);
      setShowCoach(true);
    }
  }, []);

  const markCoachSeen = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sabm-roi-coach", "1");
    }
  };

  const handleCoachClose = (persistSeen = true) => {
    setShowCoach(false);
    setCoachStep(0);
    if (persistSeen) {
      markCoachSeen();
    }
  };

  const launchCoach = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("sabm-roi-coach");
    }
    setMode("setup");
    setCoachStep(0);
    setShowCoach(true);
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
          1,
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
        totalOverride: toNumber(watchedInputs.costs?.totalOverride),
      },
      capacity: {
        source: watchedInputs.capacity?.source === "team" ? "team" : "budget",
        marketingFte: toNumber(watchedInputs.capacity?.marketingFte),
        salesFte: toNumber(watchedInputs.capacity?.salesFte),
        marketingUtilisation: toNumber(
          watchedInputs.capacity?.marketingUtilisation,
          DEFAULT_SCENARIO.capacity.marketingUtilisation,
        ),
        salesUtilisation: toNumber(
          watchedInputs.capacity?.salesUtilisation,
          DEFAULT_SCENARIO.capacity.salesUtilisation,
        ),
        hoursPerAccount: toNumber(
          watchedInputs.capacity?.hoursPerAccount,
          DEFAULT_SCENARIO.capacity.hoursPerAccount,
        ),
      },
      alignment: {
        level:
          watchedInputs.alignment?.level === "poor" ||
          watchedInputs.alignment?.level === "excellent"
            ? watchedInputs.alignment.level
            : DEFAULT_SCENARIO.alignment.level,
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

  const influenceWindowMonths = Math.max(
    0,
    sanitizedInputs.programme.durationMonths - sanitizedInputs.programme.rampMonths,
  );

  const categoryTotal = useMemo(() => {
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

  useEffect(() => {
    if (categoryTotal > 0 && flatBudget !== 0) {
      setFlatBudget(0);
    }
  }, [categoryTotal, flatBudget]);

  const availableBudgetTotal = categoryTotal > 0 ? categoryTotal : flatBudget;
  const programmeCostOverride = flatBudget > 0
    ? flatBudget
    : sanitizedInputs.costs.totalOverride && sanitizedInputs.costs.totalOverride > 0
      ? sanitizedInputs.costs.totalOverride
      : undefined;

  const budgetCapacityEstimate = useMemo(() => {
    if (sanitizedInputs.capacity.source !== "budget") {
      return undefined;
    }

    const perAccount = BUDGET_PER_ACCOUNT_ESTIMATE[tier];
    if (!Number.isFinite(perAccount) || perAccount <= 0) {
      return undefined;
    }

    const raw = Math.floor(availableBudgetTotal / perAccount);
    return Math.max(0, Math.min(5000, raw));
  }, [sanitizedInputs.capacity.source, availableBudgetTotal, tier]);

  const capacityWithBudget = useMemo(() => {
    if (sanitizedInputs.capacity.source === "budget") {
      return {
        ...sanitizedInputs.capacity,
        budgetCapacityAccounts: budgetCapacityEstimate,
      } satisfies ScenarioInputSchema["capacity"];
    }

    return sanitizedInputs.capacity;
  }, [sanitizedInputs.capacity, budgetCapacityEstimate]);

  const derivedInMarketShare = useMemo(() => {
    return deriveInMarketPct({
      durationMonths: sanitizedInputs.programme.durationMonths,
      rampMonths: sanitizedInputs.programme.rampMonths,
      buyingWindowMonths,
      pointInTimeShare: DEFAULT_POINT_IN_TIME_SHARE,
    });
  }, [
    sanitizedInputs.programme.durationMonths,
    sanitizedInputs.programme.rampMonths,
    buyingWindowMonths,
  ]);

  const derivedInMarketPercent = Math.round(Math.min(1, derivedInMarketShare) * 100);
  const cappedDerivedInMarketPercent = Math.min(70, derivedInMarketPercent);
  const baseInMarketRate = inMarketAuto
    ? cappedDerivedInMarketPercent
    : sanitizedInputs.market.inMarketRate;

  const marketForCoverage = {
    ...sanitizedInputs.market,
    inMarketRate: baseInMarketRate,
  };

  const coverageSummary = deriveCoverage(marketForCoverage, capacityWithBudget);
  const coveragePercent = Math.max(0, Math.round(coverageSummary.coverageRate * 100));
  const alignmentMultipliers = ALIGNMENT_MULTIPLIERS[sanitizedInputs.alignment.level];
  const { opportunity: alignmentOpportunity, win: alignmentWin, velocity: alignmentVelocity } =
    alignmentMultipliers;
  const alignmentLabel =
    sanitizedInputs.alignment.level === "poor"
      ? "Poor"
      : sanitizedInputs.alignment.level === "excellent"
        ? "Excellent"
        : "Standard";
  const coverageIntensity = deriveIntensity(coverageSummary.saturationRate);
  const perAccountBenchmark =
    sanitizedInputs.capacity.source === "budget" ? BUDGET_PER_ACCOUNT_ESTIMATE[tier] : null;
  const requiredBudgetValue =
    sanitizedInputs.capacity.source === "budget" && perAccountBenchmark !== null
      ? coverageSummary.requestedAccounts * perAccountBenchmark
      : null;
  const actualBudgetUsedValue =
    sanitizedInputs.capacity.source === "budget" && perAccountBenchmark !== null
      ? Math.min(availableBudgetTotal, coverageSummary.treatedAccounts * perAccountBenchmark)
      : availableBudgetTotal;
  const budgetLeftoverValue =
    sanitizedInputs.capacity.source === "budget"
      ? Math.max(0, availableBudgetTotal - actualBudgetUsedValue)
      : 0;
  const budgetShortfallValue =
    sanitizedInputs.capacity.source === "budget" && requiredBudgetValue !== null
      ? Math.max(0, requiredBudgetValue - availableBudgetTotal)
      : 0;
  const budgetIsHigh =
    sanitizedInputs.capacity.source === "budget" &&
    requiredBudgetValue !== null &&
    availableBudgetTotal > requiredBudgetValue;
  const alignmentEffectsText = `Opp ×${alignmentOpportunity.toFixed(2)}, Win ×${alignmentWin.toFixed(2)}, Velocity ×${alignmentVelocity.toFixed(2)}`;

  const effectiveCosts = useMemo(() => {
    if (sanitizedInputs.capacity.source !== "budget") {
      return sanitizedInputs.costs;
    }

    if (availableBudgetTotal <= 0 || actualBudgetUsedValue <= 0) {
      return sanitizedInputs.costs;
    }

    if (Math.abs(actualBudgetUsedValue - availableBudgetTotal) < 1) {
      return sanitizedInputs.costs;
    }

    const ratio = actualBudgetUsedValue / availableBudgetTotal;
    const keys = ["people", "media", "dataTech", "content", "agency", "other"] as const;
    const scaled: ScenarioInputSchema["costs"] = { ...sanitizedInputs.costs };
    let running = 0;

    keys.forEach((key, index) => {
      const base = sanitizedInputs.costs[key];
      let value = Math.max(0, Math.round(base * ratio));

      if (index === keys.length - 1) {
        value = Math.max(0, Math.round(actualBudgetUsedValue - running));
      } else {
        running += value;
      }

      scaled[key] = value;
    });

    const totalScaled = keys.reduce((sum, key) => sum + scaled[key], 0);

    if (totalScaled <= 0) {
      scaled.people = Math.max(0, Math.round(actualBudgetUsedValue));
    } else if (totalScaled !== Math.round(actualBudgetUsedValue)) {
      const diff = Math.round(actualBudgetUsedValue) - totalScaled;
      scaled.people = Math.max(0, scaled.people + diff);
    }

    return scaled;
  }, [
    sanitizedInputs.costs,
    sanitizedInputs.capacity.source,
    availableBudgetTotal,
    actualBudgetUsedValue,
  ]);

  useEffect(() => {
    if (!inMarketAuto) {
      return;
    }

    const target = cappedDerivedInMarketPercent;
    const current = Number(form.getValues("market.inMarketRate"));

    if (!Number.isFinite(current) || Math.abs(current - target) > 0.5) {
      form.setValue("market.inMarketRate", target, {
        shouldValidate: true,
        shouldDirty: false,
      });
    }
  }, [inMarketAuto, cappedDerivedInMarketPercent, form]);

  const handleBuyingWindowChange = (months: number) => {
    if (!Number.isFinite(months)) {
      return;
    }

    const safeMonths = Math.max(1, Math.round(months));
    setBuyingWindowMonths(safeMonths);
    setCustomBuyingWindow(true);
  };

  const handleResetBuyingWindow = () => {
    setCustomBuyingWindow(false);
    setBuyingWindowMonths(DEFAULT_BUYING_WINDOW_MONTHS[tier]);
  };

  const handleManualInMarketChange = (value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }

    const clamped = Math.max(0, Math.min(70, Math.round(value)));
    setInMarketAuto(false);
    form.setValue("market.inMarketRate", clamped, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const handleToggleInMarketAuto = (nextAuto: boolean) => {
    setInMarketAuto(nextAuto);
    if (nextAuto) {
      form.setValue("market.inMarketRate", cappedDerivedInMarketPercent, {
        shouldValidate: true,
        shouldDirty: false,
      });
    }
  };

  useEffect(() => {
    const presetDefaults = PRESET_CONFIG[preset];
    const { upliftMultipliers, inMarketMultiplier } = presetDefaults;

    const uplifts = form.getValues("uplifts");

    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));

    const applyMultiplier = (
      currentValue: unknown,
      multiplier: number,
      fallback: number,
      min: number,
      max: number,
    ): number => {
      const numeric = Number(currentValue);
      const base = Number.isFinite(numeric) ? numeric : fallback;
      const next = clamp(base * multiplier, min, max);
      return Number.isFinite(next) ? Number(next.toFixed(1)) : fallback;
    };

    const winRateCurrent = Number(uplifts?.winRateUplift);
    const winRateNext = applyMultiplier(
      uplifts?.winRateUplift,
      upliftMultipliers.winRate,
      DEFAULT_SCENARIO.uplifts.winRateUplift,
      0,
      20,
    );
    if (!Number.isFinite(winRateCurrent) || Math.abs(winRateCurrent - winRateNext) > 0.001) {
      form.setValue("uplifts.winRateUplift", winRateNext, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }

    const acvCurrent = Number(uplifts?.acvUplift);
    const acvNext = applyMultiplier(
      uplifts?.acvUplift,
      upliftMultipliers.acv,
      DEFAULT_SCENARIO.uplifts.acvUplift,
      -30,
      100,
    );
    if (!Number.isFinite(acvCurrent) || Math.abs(acvCurrent - acvNext) > 0.001) {
      form.setValue("uplifts.acvUplift", acvNext, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }

    const opportunityCurrent = Number(uplifts?.opportunityRateUplift);
    const opportunityNext = applyMultiplier(
      uplifts?.opportunityRateUplift,
      upliftMultipliers.opportunity,
      DEFAULT_SCENARIO.uplifts.opportunityRateUplift,
      0,
      100,
    );
    if (!Number.isFinite(opportunityCurrent) || Math.abs(opportunityCurrent - opportunityNext) > 0.001) {
      form.setValue("uplifts.opportunityRateUplift", opportunityNext, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }

    if (!inMarketAuto && inMarketMultiplier !== undefined) {
      const currentMarketRate = Number(form.getValues("market.inMarketRate"));
      const nextMarketRate = applyMultiplier(
        currentMarketRate,
        inMarketMultiplier,
        DEFAULT_SCENARIO.market.inMarketRate,
        0,
        70,
      );

      if (
        !Number.isFinite(currentMarketRate) ||
        Math.abs(currentMarketRate - nextMarketRate) > 0.001
      ) {
        form.setValue("market.inMarketRate", nextMarketRate, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    }
  }, [preset, form, inMarketAuto]);

  useEffect(() => {
    const capacityDirty = dirtyFields.capacity as
      | FieldNamesMarkedBoolean<ScenarioInputSchema["capacity"]>
      | undefined;
    if (capacityDirty?.hoursPerAccount) {
      return;
    }

    const defaultHours = TEAM_HOURS_PER_ACCOUNT[tier];
    const current = Number(form.getValues("capacity.hoursPerAccount"));

    if (!Number.isFinite(current) || current <= 0) {
      form.setValue("capacity.hoursPerAccount", defaultHours, {
        shouldValidate: true,
        shouldDirty: false,
      });
    }
  }, [tier, form, dirtyFields.capacity?.hoursPerAccount]);

  useEffect(() => {
    const teamWarnings: Array<{
      name: FieldPath<ScenarioInputSchema>;
      condition: boolean;
      message: string;
    }> = [
      {
        name: "capacity.marketingUtilisation",
        condition:
          sanitizedInputs.capacity.source === "team" &&
          Number.isFinite(sanitizedInputs.capacity.marketingUtilisation) &&
          sanitizedInputs.capacity.marketingUtilisation < 20,
        message: "Very low availability will restrict coverage.",
      },
      {
        name: "capacity.salesUtilisation",
        condition:
          sanitizedInputs.capacity.source === "team" &&
          Number.isFinite(sanitizedInputs.capacity.salesUtilisation) &&
          sanitizedInputs.capacity.salesUtilisation < 20,
        message: "Very low availability will restrict coverage.",
      },
      {
        name: "capacity.hoursPerAccount",
        condition:
          sanitizedInputs.capacity.source === "team" &&
          Number.isFinite(sanitizedInputs.capacity.hoursPerAccount) &&
          sanitizedInputs.capacity.hoursPerAccount < TEAM_HOURS_PER_ACCOUNT[tier],
        message: "Below typical effort—expect reduced quality.",
      },
    ];

    teamWarnings.forEach(({ name, condition, message }) => {
      const fieldState = form.getFieldState(name);
      const hasManualWarning =
        fieldState.error?.type === "manual" && fieldState.error.message === message;

      if (condition && !hasManualWarning) {
        form.setError(name, { type: "manual", message });
      } else if (!condition && hasManualWarning) {
        form.clearErrors(name);
      }
    });
  }, [form, sanitizedInputs.capacity, tier]);

  const scenarioInputs = useMemo<ScenarioInputSchema>(() => {
    return {
      ...sanitizedInputs,
      costs: {
        ...effectiveCosts,
        totalOverride: programmeCostOverride,
      },
      capacity: capacityWithBudget,
      market: {
        ...sanitizedInputs.market,
        inMarketRate: baseInMarketRate,
      },
    };
  }, [
    sanitizedInputs,
    effectiveCosts,
    capacityWithBudget,
    baseInMarketRate,
    programmeCostOverride,
  ]);

  const scenarioResult = useMemo(() => {
    const parsed = scenarioSchema.safeParse(scenarioInputs);
    if (!parsed.success) {
      return null;
    }

    return calculateScenario(parsed.data);
  }, [scenarioInputs]);

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

  const totalCostValue = scenarioResult?.outputs.incremental.totalCost ?? null;
  const programmeRevenueValue = scenarioResult?.outputs.abm.revenue ?? null;
  const programmeGrossProfitValue = scenarioResult?.outputs.abm.grossProfit ?? null;
  const profitAfterSpendValue = scenarioResult?.outputs.incremental.profitAfterSpend ?? null;
  const netRoiValue = scenarioResult?.outputs.incremental.roi ?? null;
  const grossRoiValue = scenarioResult?.outputs.incremental.grossRoi ?? null;
  const breakEvenWinsValue = scenarioResult?.outputs.incremental.breakEvenWins ?? null;
  const incrementalWinsValue = scenarioResult?.outputs.incremental.incrementalWins ?? null;
  const baselineWinsValue = scenarioResult?.outputs.baseline.expectedWins ?? null;
  const abmWinsValue = scenarioResult?.outputs.abm.expectedWins ?? null;
  const deltaWinsValue =
    baselineWinsValue !== null && abmWinsValue !== null
      ? abmWinsValue - baselineWinsValue
      : null;
  const paybackValue = scenarioResult?.outputs.incremental.paybackMonths ?? null;
  const expectedInMarketAccounts = Math.max(0, Math.round(coverageSummary.requestedAccounts));
  const baselineGrossProfitValue = scenarioResult?.outputs.baseline.grossProfit ?? null;
  const deltaProfitAfterSpendValue =
    profitAfterSpendValue !== null && baselineGrossProfitValue !== null
      ? profitAfterSpendValue - baselineGrossProfitValue
      : null;
  const meetsBreakEven =
    breakEvenWinsValue === null || incrementalWinsValue === null
      ? null
      : incrementalWinsValue >= breakEvenWinsValue;
  const profitTone: "positive" | "neutral" | "negative" =
    profitAfterSpendValue === null
      ? "neutral"
      : profitAfterSpendValue > 0
        ? "positive"
        : profitAfterSpendValue < 0
          ? "negative"
          : "neutral";
  const roiTone: "positive" | "neutral" | "negative" =
    netRoiValue === null
      ? "neutral"
      : netRoiValue >= 0
        ? "positive"
        : "negative";
  const breakEvenBadgeVariant: "outline" | "secondary" | "destructive" =
    breakEvenWinsValue === null || incrementalWinsValue === null
      ? "outline"
      : meetsBreakEven
        ? "secondary"
        : "destructive";
  const breakEvenCopy =
    breakEvenWinsValue === null
      ? "Add programme investment to calculate break-even wins and payback."
      : incrementalWinsValue === null
        ? "Incremental wins are unavailable for this scenario."
        : meetsBreakEven
          ? "Expected incremental wins meet or exceed the break-even threshold."
          : "Expected incremental wins fall short of break-even—tighten assumptions or expand scope.";

  const budgetHighHint =
    budgetIsHigh && requiredBudgetValue !== null
      ? (
        <>
          <p>
            Available budget {formatCurrencyValue(availableBudgetTotal)} exceeds the ≈
            {formatCurrencyValue(requiredBudgetValue)} needed to treat ≈
            {formatNumberValue(expectedInMarketAccounts, 0)} in-market accounts at full intensity.
          </p>
          <p>
            Only {formatCurrencyValue(actualBudgetUsedValue)} is utilised in the scenario; leftover ≈
            {formatCurrencyValue(budgetLeftoverValue)}.
          </p>
        </>
      )
      : null;

  const formatWinsForTable = (value: number | null) => {
    if (value === null) {
      return formatNumberValue(null, 1);
    }

    const rounded = Math.round(value * 10) / 10;
    const fractionDigits = Number.isInteger(rounded) ? 0 : 1;
    const formatted = formatNumberValue(rounded, fractionDigits);

    return Number.isInteger(rounded) ? formatted : `≈${formatted}`;
  };

  const formatWinsDeltaForTable = (value: number | null) => {
    if (value === null) {
      return formatNumberValue(null, 1);
    }

    const rounded = Math.round(value * 10) / 10;
    const fractionDigits = Number.isInteger(rounded) ? 0 : 1;
    const absolute = formatNumberValue(Math.abs(rounded), fractionDigits);
    const prefix = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
    const signed = prefix ? `${prefix}${absolute}` : absolute;

    return Number.isInteger(rounded) ? signed : `≈${signed}`;
  };

  const treatedAccounts = coverageSummary.treatedAccounts;
  const requestedAccounts = coverageSummary.requestedAccounts;
  const teamCapacityAccounts = coverageSummary.teamCapacityAccounts;
  const capacityBottleneck = coverageSummary.bottleneck;
  const capacityBottleneckCopy =
    capacityBottleneck === "balanced"
      ? "Balanced load across marketing and sales."
      : capacityBottleneck === "marketing"
        ? "Marketing is the current bottleneck."
        : "Sales is the current bottleneck.";
  const shortfallAccounts = Math.max(0, requestedAccounts - treatedAccounts);
  const requestRatePercent = sanitizedInputs.market.targetAccounts > 0
    ? Math.max(0, Math.round((requestedAccounts / sanitizedInputs.market.targetAccounts) * 100))
    : 0;

  const coverageShare = coverageSummary.coverageRate;

  const intensityMultiplier = useMemo(() => {
    const opportunityLift = sanitizedInputs.uplifts.opportunityRateUplift / 100;
    const winLift = sanitizedInputs.uplifts.winRateUplift / 100;
    const base = coverageShare * (
      1 +
      (opportunityLift * alignmentOpportunity) / 2 +
      (winLift * alignmentWin) / 4
    );
    return Number.isFinite(base) ? Math.max(0, base) : 0;
  }, [
    coverageShare,
    sanitizedInputs.uplifts.opportunityRateUplift,
    sanitizedInputs.uplifts.winRateUplift,
    alignmentOpportunity,
    alignmentWin,
  ]);

  const dilutionRisk = intensityMultiplier > 0.75 && sanitizedInputs.market.targetAccounts > 120;

  const cycleIntensity = coverageIntensity;

  const derivedSalesCycle = useMemo(() => {
    const baseline = sanitizedInputs.market.salesCycleMonthsBaseline;
    if (!Number.isFinite(baseline) || baseline <= 0) {
      return 0;
    }

    const reductionBase = TIER_CYCLE_REDUCTION[tier][cyclePreset];
    const reduction = reductionBase * Math.min(1, Math.max(0, cycleIntensity * alignmentVelocity));
    const derived = baseline * (1 - reduction);
    const clamped = Math.max(1, Math.min(baseline, derived));
    return Number.isFinite(clamped) ? Number(clamped.toFixed(1)) : baseline;
  }, [
    cycleIntensity,
    cyclePreset,
    sanitizedInputs.market.salesCycleMonthsBaseline,
    tier,
    alignmentVelocity,
  ]);

  const cycleReductionPercent = useMemo(() => {
    const baseline = sanitizedInputs.market.salesCycleMonthsBaseline;
    if (!Number.isFinite(baseline) || baseline <= 0) {
      return 0;
    }

    return ((baseline - derivedSalesCycle) / baseline) * 100;
  }, [derivedSalesCycle, sanitizedInputs.market.salesCycleMonthsBaseline]);

  useEffect(() => {
    if (cycleOverrideEnabled) {
      return;
    }

    const baseline = sanitizedInputs.market.salesCycleMonthsBaseline;
    if (!Number.isFinite(baseline) || baseline <= 0) {
      form.setValue("market.salesCycleMonthsAbm", 0, {
        shouldValidate: true,
        shouldDirty: false,
      });
      return;
    }

    if (!Number.isFinite(derivedSalesCycle) || derivedSalesCycle <= 0) {
      return;
    }

    const current = form.getValues("market.salesCycleMonthsAbm");
    if (Math.abs(current - derivedSalesCycle) > 0.05) {
      form.setValue("market.salesCycleMonthsAbm", derivedSalesCycle, {
        shouldValidate: true,
        shouldDirty: false,
      });
    }
  }, [
    cycleOverrideEnabled,
    derivedSalesCycle,
    form,
    sanitizedInputs.market.salesCycleMonthsBaseline,
  ]);

  const handleTotalCostChange = (value: number) => {
    if (Number.isNaN(value) || value < 0) {
      return;
    }

    setFlatBudget(value);

    const current = form.getValues("costs");
    (Object.keys(current) as Array<keyof typeof current>).forEach((key) => {
      if (current[key] !== 0) {
        form.setValue(`costs.${key}` as const, 0, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
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

  const coachSteps = useMemo<CoachStepConfig[]>(
    () => [
      {
        id: "mode-nav",
        title: "Follow the journey",
        description:
          "Switch between setup, tune, and present to move from assumptions to a board-ready pitch.",
        target: modeNavRef,
      },
      {
        id: "setup-steps",
        title: "Work through the milestones",
        description:
          "Programme, market, and budget are the key inputs. Each card holds the essentials with advanced controls tucked away.",
        target: setupStepsRef,
      },
      {
        id: "presets",
        title: "Lean on presets",
        description:
          "Tier and quick presets give you sensible defaults. Start here, then fine-tune the numbers that matter most to your plan.",
        target: presetRef,
      },
      {
        id: "setup-actions",
        title: "Advance when you’re ready",
        description:
          "Use continue to validate a step or jump to tune when the baseline looks good. You can always return here.",
        target: setupActionsRef,
      },
    ],
    [],
  );

  const availableCoachSteps = coachSteps.filter((step) => step.target.current);
  const availableCoachStepCount = availableCoachSteps.length;

  useEffect(() => {
    if (!showCoach) {
      return;
    }

    if (availableCoachStepCount === 0) {
      setShowCoach(false);
      setCoachStep(0);
      return;
    }

    if (coachStep > availableCoachStepCount - 1) {
      setCoachStep(availableCoachStepCount - 1);
    }
  }, [showCoach, availableCoachStepCount, coachStep]);

  return (
    <TooltipProvider delayDuration={200}>
      <Form {...form}>
        <form className="min-h-dvh bg-background" noValidate>
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:px-10">
            <header className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="space-y-3">
                <Image
                  src="/strategicabm_logoforwhitebg_web.jpg"
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
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={launchCoach}
                  disabled={showCoach}
                >
                  Guided tour
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="self-start bg-cta text-white hover:bg-cta/90"
                  disabled={!setupComplete}
                >
                  Export (coming soon)
                </Button>
              </div>
            </header>

            <nav
              ref={modeNavRef}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-2 text-sm font-medium"
            >
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

                <div className="flex flex-col gap-4">
                  <div
                    ref={setupStepsRef}
                    className="flex flex-wrap items-center gap-3"
                  >
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
                          highlightRef={presetRef}
                        />
                      ) : null}

                      {setupStep === "market" ? (
                        <MarketStep
                          control={form.control}
                          tier={tier}
                          autoEnabled={inMarketAuto}
                          onAutoToggle={handleToggleInMarketAuto}
                          derivedPercent={cappedDerivedInMarketPercent}
                          influenceWindowMonths={influenceWindowMonths}
                          buyingWindowMonths={buyingWindowMonths}
                          onBuyingWindowChange={handleBuyingWindowChange}
                          onResetBuyingWindow={handleResetBuyingWindow}
                          hasCustomBuyingWindow={customBuyingWindow}
                          onManualChange={handleManualInMarketChange}
                          currentValue={baseInMarketRate}
                        />
                      ) : null}

                      {setupStep === "budget" ? (
                        <BudgetStep
                          control={form.control}
                          availableBudgetTotal={availableBudgetTotal}
                          onTotalCostChange={handleTotalCostChange}
                          capacitySummary={{
                            source: sanitizedInputs.capacity.source,
                            treatedAccounts,
                            requestedAccounts,
                            teamCapacityAccounts,
                            budgetCapacityAccounts: coverageSummary.budgetCapacityAccounts,
                            coveragePercent,
                            bottleneck: capacityBottleneck,
                            totalTargets: sanitizedInputs.market.targetAccounts,
                            baseRequestRate: baseInMarketRate,
                          }}
                          alignmentLevel={sanitizedInputs.alignment.level}
                          locale={locale}
                        />
                      ) : null}

                      <div
                        ref={setupActionsRef}
                        className="flex items-center justify-between"
                      >
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
                      <InMarketField
                        control={form.control}
                        variant="tune"
                        autoEnabled={inMarketAuto}
                        onAutoToggle={handleToggleInMarketAuto}
                        derivedPercent={cappedDerivedInMarketPercent}
                        influenceWindowMonths={influenceWindowMonths}
                        buyingWindowMonths={buyingWindowMonths}
                        onBuyingWindowChange={handleBuyingWindowChange}
                        onResetBuyingWindow={handleResetBuyingWindow}
                        hasCustomBuyingWindow={customBuyingWindow}
                        onManualChange={handleManualInMarketChange}
                        currentValue={baseInMarketRate}
                        manualDescription="Anchor this to intent data or historical opportunity scans."
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
                          helper={`${coveragePercent}% of ${sanitizedInputs.market.targetAccounts} target accounts`}
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
                        {sanitizedInputs.capacity.source === "team"
                          ? shortfallAccounts > 0
                            ? `Team-led cap: ${treatedAccounts} of ${requestedAccounts} requested accounts (${coveragePercent}% coverage). ${capacityBottleneckCopy}`
                            : `Team-led coverage holds at ${treatedAccounts} accounts (${coveragePercent}% of the list). ${alignmentLabel} alignment applies ${alignmentEffectsText}.`
                          : availableBudgetTotal > 0
                            ? `Budget-led coverage assumes ${requestedAccounts} accounts (${requestRatePercent}% of the list). Alignment ${alignmentLabel} applies ${alignmentEffectsText}.`
                            : "Add investment numbers to size feasible coverage."}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle>Sales cycle impact</CardTitle>
                      <CardDescription>
                        We estimate the ABM cycle length from tier benchmarks and programme intensity.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <SalesCycleField
                        control={form.control}
                        overrideEnabled={cycleOverrideEnabled}
                        onOverrideChange={setCycleOverrideEnabled}
                        derivedValue={derivedSalesCycle}
                        baselineValue={sanitizedInputs.market.salesCycleMonthsBaseline}
                        cyclePreset={cyclePreset}
                        onCyclePresetChange={setCyclePreset}
                        cycleReductionPercent={cycleReductionPercent}
                        cycleIntensity={cycleIntensity}
                        tier={tier}
                      />
                      <p className="text-xs text-muted-foreground">
                        Typical {Math.round(TIER_CYCLE_REDUCTION[tier].typical * 100)}% · stretch {Math.round(
                          TIER_CYCLE_REDUCTION[tier].stretch * 100,
                        )}% reduction bands per tier.
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
                    <CardContent className="space-y-4">
                      <div className="grid gap-4">
                        <KpiTile
                          label="Profit after spend (this period)"
                          value={formatCurrencyValue(profitAfterSpendValue)}
                          helper={
                            totalCostValue !== null
                              ? `Programme cost ${formatCurrencyValue(totalCostValue)}`
                              : undefined
                          }
                          tone={profitTone}
                        />
                        <KpiTile
                          label="Net ROI (incremental)"
                          value={
                            typeof netRoiValue === "number"
                              ? formatPercentValue(netRoiValue * 100, 1)
                              : formatPercentValue(null, 1)
                          }
                          helper={`ROMI (gross) ${formatPercentValue(
                            typeof grossRoiValue === "number" ? grossRoiValue * 100 : null,
                            1,
                          )}`}
                          tone={roiTone}
                        />
                        <KpiTile
                          label="Payback"
                          value={formatNumberValue(
                            scenarioResult?.outputs.incremental.paybackMonths,
                            1,
                          )}
                          helper="months"
                        />
                      </div>
                      {scenarioResult ? (
                        <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                          <div className="flex flex-wrap items-center gap-2">
                            {totalCostValue !== null ? (
                              <Badge variant="outline">
                                Programme cost {formatCurrencyValue(totalCostValue)}
                              </Badge>
                            ) : null}
                            {sanitizedInputs.capacity.source === "budget" && requiredBudgetValue !== null ? (
                              <Badge variant="outline">
                                Required budget ≈{formatCurrencyValue(requiredBudgetValue)}
                              </Badge>
                            ) : null}
                            <Badge variant="outline">
                              Expected additional wins (ABM - baseline) {formatNumberValue(
                                incrementalWinsValue,
                                1,
                              )}
                            </Badge>
                            {breakEvenWinsValue !== null ? (
                              <Badge variant={breakEvenBadgeVariant}>
                                Required wins {formatNumberValue(breakEvenWinsValue, 0)}
                              </Badge>
                            ) : null}
                          </div>
                          <p>{breakEvenCopy}</p>
                        </div>
                      ) : null}
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
                        {availableBudgetTotal === 0
                          ? "Add programme investment so ROI reflects reality."
                          : `Total investment captured: ${formatCurrencyValue(availableBudgetTotal)}.`}
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
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <KpiTile
                        label="Programme revenue"
                        value={formatCurrencyValue(programmeRevenueValue)}
                        helper="ABM-attributed top-line for this period."
                      />
                      <KpiTile
                        label="Programme gross profit"
                        value={formatCurrencyValue(programmeGrossProfitValue)}
                        helper="Before programme spend."
                      />
                      <KpiTile
                        label="Programme cost"
                        value={formatCurrencyValue(totalCostValue)}
                        helper={
                          sanitizedInputs.capacity.source === "budget" && requiredBudgetValue !== null
                            ? budgetIsHigh
                              ? `Using ${formatCurrencyValue(totalCostValue)} of ${formatCurrencyValue(availableBudgetTotal)} available (leftover ≈${formatCurrencyValue(budgetLeftoverValue)})`
                              : budgetShortfallValue > 0
                                ? `Using all available ${formatCurrencyValue(availableBudgetTotal)} (needs ≈${formatCurrencyValue(requiredBudgetValue)})`
                                : `Using ${formatCurrencyValue(totalCostValue)} of ${formatCurrencyValue(availableBudgetTotal)} available.`
                            : "All-in ABM investment entered above."
                        }
                        tone={budgetIsHigh ? "negative" : budgetShortfallValue > 0 ? "negative" : "neutral"}
                      />
                      <KpiTile
                        label="Programme profit after spend"
                        value={formatCurrencyValue(profitAfterSpendValue)}
                        helper={
                          totalCostValue !== null
                            ? `Programme cost ${formatCurrencyValue(totalCostValue)}`
                            : undefined
                        }
                        tone={profitTone}
                      />
                    </div>
                    <Card className="shadow-sm">
                      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle>Programme scorecard</CardTitle>
                          <CardDescription>
                            ABM programme economics at a glance. Toggle baseline comparison when you need context.
                          </CardDescription>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <Button
                            type="button"
                            variant={showBaselineComparison ? "secondary" : "ghost"}
                            onClick={() => setShowBaselineComparison((prev) => !prev)}
                            className="h-9"
                            aria-pressed={showBaselineComparison}
                          >
                            {showBaselineComparison ? "Hide baseline" : "Show baseline"}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setShowDetails(true)}>
                            View details
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="overflow-hidden rounded-md border">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-left text-muted-foreground">
                              <tr>
                                <th className="py-2 pl-4 pr-4 font-medium">Metric</th>
                                <th className="py-2 pr-4 font-medium">ABM programme</th>
                                {showBaselineComparison ? (
                                  <>
                                    <th className="py-2 pr-4 font-medium">Baseline</th>
                                    <th className="py-2 pr-4 font-medium">Δ</th>
                                  </>
                                ) : null}
                              </tr>
                            </thead>
                            <tbody>
                              <SummaryRow
                                label="Revenue"
                                primary={formatCurrencyValue(scenarioResult.outputs.abm.revenue)}
                                secondary=
                                  {showBaselineComparison
                                    ? {
                                        baseline: formatCurrencyValue(
                                          scenarioResult.outputs.baseline.revenue,
                                        ),
                                        delta: formatCurrencyValue(
                                          scenarioResult.outputs.incremental.incrementalRevenue,
                                        ),
                                      }
                                    : undefined}
                              />
                              <SummaryRow
                                label="Gross profit"
                                primary={formatCurrencyValue(scenarioResult.outputs.abm.grossProfit)}
                                secondary=
                                  {showBaselineComparison
                                    ? {
                                        baseline: formatCurrencyValue(
                                          scenarioResult.outputs.baseline.grossProfit,
                                        ),
                                        delta: formatCurrencyValue(
                                          scenarioResult.outputs.incremental.incrementalGrossProfit,
                                        ),
                                      }
                                    : undefined}
                              />
                              <SummaryRow
                                label="Programme cost"
                                primary={formatCurrencyValue(totalCostValue)}
                                hint={budgetHighHint}
                                secondary=
                                  {showBaselineComparison
                                    ? {
                                        baseline: formatCurrencyValue(0),
                                        delta: formatCurrencyValue(totalCostValue),
                                      }
                                    : undefined}
                              />
                              <SummaryRow
                                label="Profit after spend"
                                primary={formatCurrencyValue(profitAfterSpendValue)}
                                secondary=
                                  {showBaselineComparison
                                    ? {
                                        baseline: formatCurrencyValue(baselineGrossProfitValue),
                                        delta: formatCurrencyValue(deltaProfitAfterSpendValue),
                                      }
                                    : undefined}
                              />
                              <SummaryRow
                                label="Wins"
                                primary={formatWinsForTable(abmWinsValue)}
                                secondary=
                                  {showBaselineComparison
                                    ? {
                                        baseline: formatWinsForTable(baselineWinsValue),
                                        delta: formatWinsDeltaForTable(deltaWinsValue),
                                      }
                                    : undefined}
                              />
                            </tbody>
                          </table>
                        </div>
                        {budgetIsHigh && requiredBudgetValue !== null ? (
                          <div className="rounded-md bg-destructive/10 p-3 text-xs font-medium text-destructive">
                            Spend exceeds the typical requirement. Required spend ≈{formatCurrencyValue(requiredBudgetValue)};
                            current inputs are {formatCurrencyValue(budgetLeftoverValue)} higher and remain unused in this scenario.
                          </div>
                        ) : null}
                        {!budgetIsHigh && budgetShortfallValue > 0 && requiredBudgetValue !== null ? (
                          <div className="rounded-md bg-amber-100 p-3 text-xs font-medium text-amber-700">
                            Available budget {formatCurrencyValue(availableBudgetTotal)} is below the ≈
                            {formatCurrencyValue(requiredBudgetValue)} recommended to fully cover in-market demand. The model uses all
                            available funds; shortfall ≈{formatCurrencyValue(budgetShortfallValue)}.
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">
                            Net ROI {formatPercentValue(
                              typeof netRoiValue === "number" ? netRoiValue * 100 : null,
                              1,
                            )}
                          </Badge>
                          <Badge variant="outline">
                            Gross ROMI {formatPercentValue(
                              typeof grossRoiValue === "number" ? grossRoiValue * 100 : null,
                              1,
                            )}
                          </Badge>
                          <Badge variant="outline">
                            Payback {formatNumberValue(paybackValue, 1)} mo
                          </Badge>
                          {sanitizedInputs.capacity.source === "budget" && requiredBudgetValue !== null ? (
                            <Badge variant={budgetIsHigh ? "destructive" : "outline"}>
                              {budgetIsHigh ? "Over benchmark spend" : "Required budget"}
                              {` ≈${formatCurrencyValue(requiredBudgetValue)}`}
                            </Badge>
                          ) : null}
                          {budgetLeftoverValue > 0 ? (
                            <Badge variant="outline">Budget leftover ≈{formatCurrencyValue(budgetLeftoverValue)}</Badge>
                          ) : null}
                          {budgetShortfallValue > 0 ? (
                            <Badge variant="destructive">
                              Budget shortfall ≈{formatCurrencyValue(budgetShortfallValue)}
                            </Badge>
                          ) : null}
                          <Badge variant="outline">
                            Expected additional wins (ABM - baseline) {formatNumberValue(
                              incrementalWinsValue,
                              1,
                            )}
                          </Badge>
                          {breakEvenWinsValue !== null ? (
                            <Badge variant={breakEvenBadgeVariant}>
                              Required wins {formatNumberValue(breakEvenWinsValue, 0)}
                            </Badge>
                          ) : null}
                        </div>
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
                      <Button type="button" variant="outline" onClick={() => setMode("setup")}>Back to step 1</Button>
                    </CardContent>
                  </Card>
                )}
              </section>
            ) : null}

            <footer className="mt-12 border-t border-border/60 pt-6">
              <p className="text-xs text-muted-foreground">
                Need a refresher on the inputs and outputs?{" "}
                <Link
                  href="/glossary"
                  className="font-medium text-cta hover:text-cta/80"
                >
                  Explore the glossary
                </Link>
                .
              </p>
            </footer>
          </div>
        </form>
      </Form>

      {showCoach && availableCoachStepCount > 0 ? (
        <CoachOverlay
          steps={availableCoachSteps}
          stepIndex={Math.min(coachStep, availableCoachStepCount - 1)}
          onNext={() =>
            setCoachStep((prev) => Math.min(prev + 1, availableCoachStepCount - 1))
          }
          onPrev={() => setCoachStep((prev) => Math.max(prev - 1, 0))}
          onSkip={() => handleCoachClose()}
          onFinish={() => handleCoachClose()}
        />
      ) : null}

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
              <Button type="button" variant="ghost" onClick={() => setShowDetails(false)}>
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
                      <th className="py-2 pr-4 font-medium">ABM programme</th>
                      <th className="py-2 pr-4 font-medium">Baseline</th>
                      <th className="py-2 font-medium">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SummaryRow
                      label="Opportunities"
                      primary={formatNumberValue(
                        scenarioResult.outputs.abm.qualifiedOpps,
                        1,
                      )}
                      secondary={{
                        baseline: formatNumberValue(
                          scenarioResult.outputs.baseline.qualifiedOpps,
                          1,
                        ),
                        delta: formatNumberValue(
                          scenarioResult.outputs.abm.qualifiedOpps -
                            scenarioResult.outputs.baseline.qualifiedOpps,
                          1,
                        ),
                      }}
                    />
                    <SummaryRow
                      label="Revenue"
                      primary={formatCurrencyValue(
                        scenarioResult.outputs.abm.revenue,
                      )}
                      secondary={{
                        baseline: formatCurrencyValue(
                          scenarioResult.outputs.baseline.revenue,
                        ),
                        delta: formatCurrencyValue(
                          scenarioResult.outputs.incremental.incrementalRevenue,
                        ),
                      }}
                    />
                    <SummaryRow
                      label="Gross profit"
                      primary={formatCurrencyValue(
                        scenarioResult.outputs.abm.grossProfit,
                      )}
                      secondary={{
                        baseline: formatCurrencyValue(
                          scenarioResult.outputs.baseline.grossProfit,
                        ),
                        delta: formatCurrencyValue(
                          scenarioResult.outputs.incremental.incrementalGrossProfit,
                        ),
                      }}
                    />
                    <SummaryRow
                      label="Programme cost"
                      primary={formatCurrencyValue(totalCostValue)}
                      secondary={{
                        baseline: formatCurrencyValue(0),
                        delta: formatCurrencyValue(totalCostValue),
                      }}
                    />
                    <SummaryRow
                      label="Profit after spend"
                      primary={formatCurrencyValue(profitAfterSpendValue)}
                      secondary={{
                        baseline: formatCurrencyValue(baselineGrossProfitValue),
                        delta: formatCurrencyValue(deltaProfitAfterSpendValue),
                      }}
                    />
                    <SummaryRow
                      label="Net ROI (incremental)"
                      primary="—"
                      secondary={{
                        baseline: "—",
                        delta:
                          typeof scenarioResult.outputs.incremental.roi === "number"
                            ? formatPercentValue(
                                scenarioResult.outputs.incremental.roi * 100,
                                1,
                              )
                            : "—",
                      }}
                    />
                    <SummaryRow
                      label="Gross ROMI"
                      primary="—"
                      secondary={{
                        baseline: "—",
                        delta:
                          typeof scenarioResult.outputs.incremental.grossRoi === "number"
                            ? formatPercentValue(
                                scenarioResult.outputs.incremental.grossRoi * 100,
                                1,
                              )
                            : "—",
                      }}
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

type CoachOverlayProps = {
  steps: CoachStepConfig[];
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
};

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function CoachOverlay({ steps, stepIndex, onNext, onPrev, onSkip, onFinish }: CoachOverlayProps) {
  const step = steps[stepIndex];
  const totalSteps = steps.length;
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (!step) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const target = step.target.current;
    if (!target) {
      return;
    }

    const bounding = target.getBoundingClientRect();
    const gutter = 96;
    if (bounding.top < gutter || bounding.bottom > window.innerHeight - gutter) {
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      });
    }
  }, [step]);

  useLayoutEffect(() => {
    if (!step) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const updateRect = () => {
      const target = step.target.current;
      if (!target) {
        setRect(null);
        return;
      }

      const bounding = target.getBoundingClientRect();
      setRect({
        top: bounding.top,
        left: bounding.left,
        width: bounding.width,
        height: bounding.height,
      });
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateRect();

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [step]);

  if (!step || !rect || rect.width === 0 || rect.height === 0) {
    return null;
  }

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;
  const padding = 12;
  const highlightTop = Math.max(rect.top - padding, 8);
  const highlightLeft = Math.max(rect.left - padding, 8);
  const highlightWidth = Math.max(
    40,
    viewport.width
      ? Math.min(rect.width + padding * 2, viewport.width - highlightLeft - 8)
      : rect.width + padding * 2,
  );
  const highlightHeight = Math.max(
    40,
    viewport.height
      ? Math.min(rect.height + padding * 2, viewport.height - highlightTop - 8)
      : rect.height + padding * 2,
  );
  const cardMaxWidth = viewport.width ? Math.min(320, viewport.width - 32) : 320;
  const highlightCenter = highlightLeft + highlightWidth / 2;
  let cardLeft = highlightCenter - cardMaxWidth / 2;
  cardLeft = Math.max(16, cardLeft);
  if (viewport.width) {
    cardLeft = Math.min(cardLeft, viewport.width - cardMaxWidth - 16);
  }
  const estimatedCardHeight = 220;
  let cardTop = highlightTop + highlightHeight + 16;
  if (viewport.height && cardTop + estimatedCardHeight > viewport.height - 16) {
    cardTop = Math.max(highlightTop - (estimatedCardHeight + 16), 16);
  }

  const handleNext = () => {
    if (isLast) {
      onFinish();
      return;
    }
    onNext();
  };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <div
        className="pointer-events-none absolute rounded-xl border-2 border-cta shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-all duration-200"
        style={{
          top: highlightTop,
          left: highlightLeft,
          width: highlightWidth,
          height: highlightHeight,
        }}
      />
      <div
        className="absolute flex max-w-xs flex-col gap-3 rounded-lg bg-background p-4 text-sm shadow-lg ring-1 ring-border"
        style={{ top: cardTop, left: cardLeft, width: cardMaxWidth }}
      >
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Step {stepIndex + 1} of {totalSteps}
        </span>
        <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
        <p className="text-sm text-muted-foreground">{step.description}</p>
        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            Skip tour
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPrev}
              disabled={isFirst}
            >
              Back
            </Button>
            <Button type="button" size="sm" onClick={handleNext}>
              {isLast ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

type ProgrammeStepProps = {
  control: Control<ScenarioInputSchema>;
  onSelectTier: (tier: TierKey) => void;
  selectedTier: TierKey;
  onSelectPreset: (preset: PresetKey) => void;
  selectedPreset: PresetKey;
  highlightRef: RefObject<HTMLDivElement | null>;
};

function ProgrammeStep({
  control,
  onSelectTier,
  selectedTier,
  onSelectPreset,
  selectedPreset,
  highlightRef,
}: ProgrammeStepProps) {
  return (
    <div className="space-y-6" ref={highlightRef}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-1 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tier presets
          </span>
          <div className="grid gap-2">
            {(Object.keys(TIER_CONFIG) as TierKey[]).map((tier) => {
              const config = TIER_CONFIG[tier];
              const active = tier === selectedTier;

              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => onSelectTier(tier)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition ${
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
            Expectations Presets
          </span>
          <div className="grid gap-2">
            {(Object.keys(PRESET_CONFIG) as PresetKey[]).map((key) => {
              const config = PRESET_CONFIG[key];
              const active = key === selectedPreset;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectPreset(key)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition ${
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
          sublabel="How many months will the programme run from kickoff to finish?"
          suffix="mo"
        />
        <NumberField
          control={control}
          name="programme.rampMonths"
          label="Ramp-up period (months)"
          hint="How quickly the programme reaches steady-state performance."
          sublabel="Months before ABM impact reaches steady state."
          suffix="mo"
        />
      </div>

      <AdvancedBlock title="Formatting">
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
  autoEnabled: boolean;
  onAutoToggle: (value: boolean) => void;
  derivedPercent: number;
  influenceWindowMonths: number;
  buyingWindowMonths: number;
  onBuyingWindowChange: (value: number) => void;
  onResetBuyingWindow: () => void;
  hasCustomBuyingWindow: boolean;
  onManualChange: (value: number) => void;
  currentValue: number;
};

function MarketStep({
  control,
  tier,
  autoEnabled,
  onAutoToggle,
  derivedPercent,
  influenceWindowMonths,
  buyingWindowMonths,
  onBuyingWindowChange,
  onResetBuyingWindow,
  hasCustomBuyingWindow,
  onManualChange,
  currentValue,
}: MarketStepProps) {
  const tierNote = TIER_CONFIG[tier];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          {tierNote.label} lens: we typically see around {tierNote.defaultAccounts} accounts at this level of personalisation. Keep your own numbers if they differ.
        </p>
      </div>
      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <NumberField
            control={control}
            name="market.targetAccounts"
            label="Target accounts"
            hint="Total accounts in scope for this ABM programme."
            sublabel="How many accounts are you planning to include in this programme?"
          />
          <NumberField
            control={control}
            name="market.baselineWinRate"
            label="Baseline win rate (%)"
            hint="Historical close rate without ABM influence."
            sublabel="Historic close rate before ABM support."
            suffix="%"
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <NumberField
            control={control}
            name="market.baselineAcv"
            label="Baseline ACV"
            prefix="£"
            hint="Average contract value per deal before ABM uplift."
            sublabel="Average deal size you typically see today."
          />
          <NumberField
            control={control}
            name="market.contributionMargin"
            label="Contribution margin (%)"
            hint="Gross margin expected on recognised revenue."
            sublabel="Use your gross margin for the products in scope."
            suffix="%"
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <NumberField
            control={control}
            name="market.salesCycleMonthsBaseline"
            label="Sales cycle (baseline months)"
            hint="Typical time to close a deal today, in months."
            sublabel="How long a deal takes today from opportunity to close."
            suffix="mo"
          />
          <InMarketField
            control={control}
            variant="setup"
            autoEnabled={autoEnabled}
            onAutoToggle={onAutoToggle}
            derivedPercent={derivedPercent}
            influenceWindowMonths={influenceWindowMonths}
            buyingWindowMonths={buyingWindowMonths}
            onBuyingWindowChange={onBuyingWindowChange}
            onResetBuyingWindow={onResetBuyingWindow}
            hasCustomBuyingWindow={hasCustomBuyingWindow}
            onManualChange={onManualChange}
            currentValue={currentValue}
          />
        </div>
      </div>
    </div>
  );
}

type BudgetCapacitySummary = {
  source: "budget" | "team";
  treatedAccounts: number;
  requestedAccounts: number;
  teamCapacityAccounts: number;
  budgetCapacityAccounts: number | null;
  coveragePercent: number;
  bottleneck: CapacityBottleneck;
  totalTargets: number;
  baseRequestRate: number;
};

type BudgetStepProps = {
  control: Control<ScenarioInputSchema>;
  availableBudgetTotal: number;
  onTotalCostChange: (value: number) => void;
  capacitySummary: BudgetCapacitySummary;
  alignmentLevel: AlignmentLevel;
  locale: string;
};

function BudgetStep({
  control,
  availableBudgetTotal,
  onTotalCostChange,
  capacitySummary,
  alignmentLevel,
  locale,
}: BudgetStepProps) {
  const {
    source,
    treatedAccounts,
    requestedAccounts,
    budgetCapacityAccounts,
    coveragePercent,
    bottleneck,
    totalTargets,
    baseRequestRate,
  } = capacitySummary;
  const shortfall = Math.max(0, requestedAccounts - treatedAccounts);
  const requestRateLabel = Math.max(0, Math.round(baseRequestRate));
  const coverageLabel = Math.max(0, Math.round(coveragePercent));
  const alignmentDescriptions: Record<AlignmentLevel, string> = {
    poor: "Teams work in silos—follow-up slows and uplifts dip.",
    standard: "Shared rhythms with a few gaps. Reliable default for most plans.",
    excellent: "Joint planning and fast follow-up boost wins and speed.",
  };
  const alignmentMultipliers = ALIGNMENT_MULTIPLIERS[alignmentLevel];
  const formatInt = (value: number) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(Math.max(0, Math.round(value)));
  const targetListCount = Math.max(0, Math.round(totalTargets));
  const expectedInMarket = Math.max(0, requestedAccounts);
  const rawBudgetCapacity = Math.max(0, Math.round(budgetCapacityAccounts ?? targetListCount));
  const effectiveBudgetCapacity = targetListCount > 0
    ? Math.min(rawBudgetCapacity, targetListCount)
    : rawBudgetCapacity;
  const overflowBudget = targetListCount > 0 && rawBudgetCapacity > targetListCount;
  const inMarketBadge = `≈${formatInt(expectedInMarket)}`;
  const budgetCapacityBadge = targetListCount > 0
    ? overflowBudget
      ? `${formatInt(targetListCount)}+`
      : `≈${formatInt(effectiveBudgetCapacity)}`
    : `≈${formatInt(rawBudgetCapacity)}`;
  const budgetHeadroom = effectiveBudgetCapacity - expectedInMarket;
  let budgetVerdict = "";
  let budgetVerdictLabel = "";
  let budgetVerdictVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let budgetTooltip = "";

  if (targetListCount <= 0) {
    budgetVerdict = "Add a positive target list to estimate coverage.";
    budgetVerdictLabel = "Need inputs";
    budgetVerdictVariant = "outline";
    budgetTooltip = "We need a non-zero target account list before we can estimate demand vs capacity.";
  } else if (expectedInMarket <= 0) {
    budgetVerdict = "No accounts are expected to be in-market this period, so your budget has full headroom.";
    budgetVerdictLabel = "Full headroom";
    budgetVerdictVariant = "secondary";
    budgetTooltip = "In-market accounts drive demand. With none expected, the full budget remains headroom.";
  } else if (budgetHeadroom > 0) {
    if (overflowBudget) {
      budgetVerdict = `Your budget covers the entire ${formatInt(targetListCount)}-account list at full intensity, leaving headroom to treat ≈${formatInt(budgetHeadroom)} more accounts than expected in-market.`;
      budgetTooltip = "We convert spend to capacity using tier defaults (≈£60k/£23.5k/£6k per account). Your spend exceeds even the full list size.";
    } else {
      budgetVerdict = `Your budget covers all ≈${formatInt(expectedInMarket)} expected in-market accounts at full intensity (headroom ≈${formatInt(budgetHeadroom)}).`;
      budgetTooltip = "Headroom = budget capacity minus expected in-market accounts. Capacity uses your tier’s spend-per-account benchmark.";
    }
    budgetVerdictLabel = "Headroom";
    budgetVerdictVariant = "secondary";
  } else if (budgetHeadroom === 0) {
    budgetVerdict = `Your budget roughly matches the ≈${formatInt(expectedInMarket)} in-market accounts expected this plan.`;
    budgetVerdictLabel = "At limit";
    budgetVerdictVariant = "default";
    budgetTooltip = "Capacity is roughly equal to demand. Consider adding buffer if you expect more accounts to activate.";
  } else {
    budgetVerdict = `Your budget covers ≈${formatInt(effectiveBudgetCapacity)} of ≈${formatInt(expectedInMarket)} in-market accounts—shortfall ≈${formatInt(-budgetHeadroom)}.`;
    budgetVerdictLabel = "Shortfall";
    budgetVerdictVariant = "destructive";
    budgetTooltip = "Shortfall = demand minus capacity. Increase spend or lower scope to lift capacity.";
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Total programme investment
          </label>
          <Input
            value={availableBudgetTotal}
            onChange={(event) => onTotalCostChange(Number(event.target.value))}
            inputMode="decimal"
            className="text-base"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Enter the blended annual budget. Split it out if you want more detail.
          </p>
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer text-xs font-semibold text-foreground">
              What to include?
            </summary>
            <div className="mt-1 space-y-1">
              <p>
                Include all ABM programme spend for the year: people costs, paid media, data/tech, content, agency,
                and other execution line items dedicated to this plan.
              </p>
              <p>
                Exclude wider sales or marketing costs that are already accounted for elsewhere so the ROI view stays
                focused on incremental programme investment.
              </p>
            </div>
          </details>
        </div>

        <AdvancedBlock title="Break down the budget (optional)">
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

      <div className="space-y-4 rounded-lg border border-dashed bg-muted/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Capacity cap
            </p>
            <p className="text-xs text-muted-foreground">
              Limit coverage by budget or team time.
            </p>
          </div>
          <FormField
            control={control}
            name="capacity.source"
            render={({ field }) => (
              <FormItem className="w-full max-w-[220px] space-y-1">
                <FormLabel>Cap coverage by</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Cap coverage by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="budget">Budget</SelectItem>
                      <SelectItem value="team">Team time</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        {source === "budget" ? (
          <div className="rounded-md border bg-background/60 p-3 text-xs text-muted-foreground">
            <p className="mb-2">
              Team capacity is optional when you cap by budget. Switch to
              {" "}&ldquo;Team time&rdquo; if bandwidth is the constraint.
            </p>
            {totalTargets > 0 ? (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">Target list: {formatInt(totalTargets)}</Badge>
                <Badge variant="outline">In-market this plan: {inMarketBadge}</Badge>
                <Badge variant="outline">Budget capacity: {budgetCapacityBadge}</Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant={budgetVerdictVariant} className="flex cursor-default items-center gap-1">
                      {budgetVerdictLabel}
                      {budgetTooltip ? <Info className="h-3 w-3" aria-hidden /> : null}
                    </Badge>
                  </TooltipTrigger>
                  {budgetTooltip ? (
                    <TooltipContent side="top" align="center" className="max-w-xs text-xs">
                      {budgetTooltip}
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </div>
            ) : null}
            <p>{budgetVerdict}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                control={control}
                name="capacity.marketingFte"
                label="Marketers (FTE)"
                hint="Count part-timers as fractions, e.g. 1.5 = one full-time + one half-time."
                sublabel="Full-time equivalents on this plan (fractions allowed)."
              />
              <NumberField
                control={control}
                name="capacity.salesFte"
                label="Sellers (FTE)"
                hint="Count part-timers as fractions if sellers split coverage."
                sublabel="Reps covering treated accounts."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                control={control}
                name="capacity.marketingUtilisation"
                label="Marketing time available (%)"
                suffix="%"
                hint="Consider other projects, holidays, and meetings. 70% is a common ceiling."
                sublabel="Share of each marketer’s time for this plan."
              />
              <NumberField
                control={control}
                name="capacity.salesUtilisation"
                label="Sales time available (%)"
                suffix="%"
                hint="Use a lower value if reps carry a full quota. 50% is typical."
                sublabel="Share of each seller’s time for this plan."
              />
            </div>

            <AdvancedBlock title="Advanced (team time)">
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  control={control}
                  name="capacity.hoursPerAccount"
                  label="Hours per treated account (month)"
                  suffix="h"
                  hint="Defaults: 1:1 = 32 h · 1:few = 12 h · 1:many = 3 h."
                  sublabel="Typical effort to run ABM per account; set by tier."
                />
              </div>
            </AdvancedBlock>

            <div className="rounded-md border bg-background/60 p-3 text-xs text-muted-foreground">
              <p>
                Requested coverage: {requestedAccounts} accounts
                {totalTargets > 0 ? ` (${requestRateLabel}% of ${totalTargets} targets).` : "."}
              </p>
              <p>
                Your team can fully treat {budgetCapacityAccounts} of {requestedAccounts} accounts ({coverageLabel}%).
                {" "}
                {bottleneck === "balanced" ? (
                  "Balanced load across marketing and sales."
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted underline-offset-2">
                        Bottleneck: {bottleneck === "marketing" ? "marketing" : "sales"}.
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" className="max-w-xs text-xs">
                      We use the smaller of marketing and sales hours to cap coverage.
                    </TooltipContent>
                  </Tooltip>
                )}
              </p>
              {shortfall > 0 ? (
                <p>
                  Shortfall of {shortfall} accounts until you add headcount or reduce scope.
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
        <FormField
          control={control}
          name="alignment.level"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-2">
                <FormLabel>Sales &amp; marketing alignment</FormLabel>
                <HintTooltip
                  label="Sales and marketing alignment"
                  hint="Alignment changes ABM effectiveness. Poor reduces uplifts and slows deals; excellent boosts both."
                />
              </div>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select alignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="excellent">Excellent</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="text-xs text-muted-foreground">{alignmentDescriptions[alignmentLevel]}</p>
        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
          <span>Opp uplift ×{alignmentMultipliers.opportunity.toFixed(2)}</span>
          <span>Win uplift ×{alignmentMultipliers.win.toFixed(2)}</span>
          <span>Velocity ×{alignmentMultipliers.velocity.toFixed(2)}</span>
        </div>
      </div>

      
    </div>
  );
}

type InMarketFieldProps = {
  control: Control<ScenarioInputSchema>;
  variant: "setup" | "tune";
  autoEnabled: boolean;
  onAutoToggle: (value: boolean) => void;
  derivedPercent: number;
  influenceWindowMonths: number;
  buyingWindowMonths: number;
  onBuyingWindowChange: (value: number) => void;
  onResetBuyingWindow: () => void;
  hasCustomBuyingWindow: boolean;
  onManualChange: (value: number) => void;
  currentValue: number;
  manualDescription?: string;
};

function InMarketField({
  control,
  variant,
  autoEnabled,
  onAutoToggle,
  derivedPercent,
  influenceWindowMonths,
  buyingWindowMonths,
  onBuyingWindowChange,
  onResetBuyingWindow,
  hasCustomBuyingWindow,
  onManualChange,
  currentValue,
  manualDescription,
}: InMarketFieldProps) {
  const derivedCopy = influenceWindowMonths > 0
    ? "We convert the 95:5 rule into a programme-year rate based on how long buyers stay active."
    : "No active window after ramp—set a shorter ramp or longer duration to open it up.";

  const helperCopy =
    variant === "setup"
      ? "% of your target list expected to start an evaluation during the programme."
      : "Stay aligned with your plan window—changes to duration or ramp update this automatically.";

  const manualLabel = variant === "setup" ? "Manual in-market rate" : "Override in-market rate";
  const defaultValue = Number.isFinite(currentValue) ? currentValue : derivedPercent;
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <FormField
      control={control}
      name="market.inMarketRate"
      render={({ field }) => {
        const rawValue: unknown = field.value;
        let parsedFieldValue: number | undefined;

        if (typeof rawValue === "number") {
          parsedFieldValue = Number.isFinite(rawValue) ? rawValue : undefined;
        } else if (typeof rawValue === "string") {
          const trimmed = rawValue.trim();
          if (trimmed !== "") {
            const numeric = Number(trimmed);
            parsedFieldValue = Number.isFinite(numeric) ? numeric : undefined;
          }
        }

        const liveValue = autoEnabled ? derivedPercent : parsedFieldValue ?? defaultValue;
        const sliderValue = Math.min(
          IN_MARKET_SLIDER_BOUNDS.max,
          Math.max(IN_MARKET_SLIDER_BOUNDS.min, Math.round(liveValue)),
        );

        const displayValue = autoEnabled
          ? String(Math.max(0, derivedPercent))
          : parsedFieldValue !== undefined
            ? String(parsedFieldValue)
            : typeof rawValue === "string"
              ? rawValue
              : "";

        const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
          const next = numberParser(event.target.value);

          if (next === "") {
            field.onChange("");
            onAutoToggle(false);
            return;
          }

          if (typeof next === "number" && Number.isFinite(next)) {
            onManualChange(next);
          }
        };

        return (
          <FormItem>
            <div className="flex items-center justify-between gap-2">
              <FormLabel>In-market rate (%)</FormLabel>
              <HintTooltip
                label="In-market rate"
                hint="The share of your target accounts likely to start an evaluation during this plan. We estimate it from the 95:5 rule, your buying window, and your plan length after ramp-up."
              />
            </div>
            <p className="text-xs text-muted-foreground">{helperCopy}</p>
            <FormControl>
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    ref={field.ref}
                    name={field.name}
                    value={displayValue}
                    onChange={handleInputChange}
                    onBlur={field.onBlur}
                    inputMode="decimal"
                    readOnly={autoEnabled}
                    className={cn(
                      "pr-28",
                      autoEnabled && "cursor-default bg-muted/30",
                    )}
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge
                      variant={autoEnabled ? "secondary" : "destructive"}
                      className="pointer-events-none"
                    >
                      {autoEnabled ? "Auto" : "Manual"}
                    </Badge>
                    <span>%</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-cta underline-offset-2 hover:underline"
                  onClick={() => setDetailsOpen((prev) => !prev)}
                >
                  {detailsOpen ? "Hide calculation details" : "How is this calculated?"}
                </button>
                {detailsOpen ? (
                  <div className="space-y-4 rounded-md border bg-muted/20 p-3">
                    {autoEnabled ? (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Derived rate</p>
                            <p className="text-2xl font-semibold">{Math.max(0, derivedPercent)}%</p>
                          </div>
                          <Badge variant="secondary">Auto</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{derivedCopy}</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-muted-foreground">Buying window</p>
                            <HintTooltip
                              label="Buying window"
                              hint="The period an account is actively evaluating (shortlisting, trials, negotiation). It’s shorter than your full sales cycle."
                            />
                          </div>
                          <Select
                            value={String(buyingWindowMonths)}
                            onValueChange={(value) => {
                              const months = Number(value);
                              if (!Number.isNaN(months)) {
                                onBuyingWindowChange(months);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-[220px] text-left">
                              <SelectValue placeholder="Buying window" />
                            </SelectTrigger>
                            <SelectContent>
                              {BUYING_WINDOW_OPTIONS.map((option) => {
                                const months = Number(option);
                                const label = months === 2
                                  ? "about 2 months active"
                                  : months === 3
                                    ? "about 3 months active"
                                    : months === 4
                                      ? "about 4 months active"
                                      : "about 6 months active";
                                return (
                                  <SelectItem key={option} value={String(option)}>
                                    {label}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Pick how long buyers are typically in active evaluation. We’ll recalculate the rate for your plan.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="cursor-help">
                                95:5 at {(DEFAULT_POINT_IN_TIME_SHARE * 100).toFixed(0)}%
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center" className="max-w-xs text-xs">
                              Adjust if your category sits closer to 4–6% in-market at any moment.
                            </TooltipContent>
                          </Tooltip>
                          {hasCustomBuyingWindow ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={onResetBuyingWindow}
                            >
                              Reset to benchmark
                            </Button>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDetailsOpen(true);
                              onAutoToggle(false);
                            }}
                          >
                            Manual override
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Manual rate</p>
                            <p className="text-2xl font-semibold">{sliderValue}%</p>
                          </div>
                          <Badge variant="destructive">Manual</Badge>
                        </div>
                        <SliderWithBenchmark
                          label={manualLabel}
                          value={sliderValue}
                          onChange={onManualChange}
                          min={IN_MARKET_SLIDER_BOUNDS.min}
                          max={IN_MARKET_SLIDER_BOUNDS.max}
                          baseMin={IN_MARKET_SLIDER_BOUNDS.baseMin}
                          baseMax={IN_MARKET_SLIDER_BOUNDS.baseMax}
                          stretchMin={IN_MARKET_SLIDER_BOUNDS.stretchMin}
                          stretchMax={IN_MARKET_SLIDER_BOUNDS.stretchMax}
                          unit="%"
                          description={manualDescription}
                        />
                        <p className="text-xs text-muted-foreground">
                          You’re editing the rate directly. Make sure you can justify this assumption in your export.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onAutoToggle(true);
                              setDetailsOpen(true);
                            }}
                          >
                            Return to auto
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
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
  tone?: "positive" | "neutral" | "negative";
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
  primary: string;
  secondary?: {
    baseline: string;
    delta: string;
  };
  hint?: ReactNode;
};

function SummaryRow({ label, primary, secondary, hint }: SummaryRowProps) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2 pr-4 font-medium text-foreground">
        <span className="inline-flex items-center gap-1">
          {label}
          <HintTooltip hint={hint} label={label} />
        </span>
      </td>
      <td className="py-2 pr-4">{primary}</td>
      {secondary ? (
        <>
          <td className="py-2 pr-4">{secondary.baseline}</td>
          <td className="py-2 pr-4 font-medium text-cta">{secondary.delta}</td>
        </>
      ) : null}
    </tr>
  );
}

function HintTooltip({ hint, label }: { hint?: ReactNode; label: string }) {
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
      <TooltipContent side="top" align="end" className="max-w-xs space-y-1 text-sm">
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
  suffix?: string;
  hint?: string;
  sublabel?: string;
};

function NumberField<Name extends FieldPath<ScenarioInputSchema>>({
  control,
  name,
  label,
  prefix,
  suffix,
  hint,
  sublabel,
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
          {sublabel ? (
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          ) : null}
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
                className={cn(prefix ? "pl-7" : undefined, suffix ? "pr-7" : undefined)}
              />
              {suffix ? (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  {suffix}
                </span>
              ) : null}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

type SalesCycleFieldProps = {
  control: Control<ScenarioInputSchema>;
  overrideEnabled: boolean;
  onOverrideChange: (value: boolean) => void;
  derivedValue: number;
  baselineValue: number;
  cyclePreset: CyclePresetKey;
  onCyclePresetChange: (preset: CyclePresetKey) => void;
  cycleReductionPercent: number;
  cycleIntensity: number;
  tier: TierKey;
};

function SalesCycleField({
  control,
  overrideEnabled,
  onOverrideChange,
  derivedValue,
  baselineValue,
  cyclePreset,
  onCyclePresetChange,
  cycleReductionPercent,
  cycleIntensity,
  tier,
}: SalesCycleFieldProps) {
  const reductionConfig = TIER_CYCLE_REDUCTION[tier];
  const derivedLabel = Number.isFinite(derivedValue) && derivedValue > 0 ? derivedValue.toFixed(1) : "0.0";
  const baselineLabel = Number.isFinite(baselineValue) && baselineValue > 0 ? baselineValue.toFixed(1) : "—";
  const intensityLabel = Number.isFinite(cycleIntensity) && cycleIntensity > 0 ? cycleIntensity.toFixed(2) : "0.00";
  const reductionLabel = Number.isFinite(cycleReductionPercent)
    ? `${Math.max(0, Math.round(cycleReductionPercent))}%`
    : "0%";
  const warnLowBaseline = Number.isFinite(baselineValue) && baselineValue > 0 && baselineValue < 2;
  const selectedReduction = Math.round(reductionConfig[cyclePreset] * 100);
  const presetLabel = cyclePreset === "typical" ? "typical" : "stretch";

  return (
    <FormField
      control={control}
      name="market.salesCycleMonthsAbm"
      render={({ field }) => {
        const fieldValue =
          field.value === undefined || field.value === null ? "" : String(field.value);

        return (
          <FormItem className="mt-6 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <FormLabel>Sales cycle (ABM)</FormLabel>
                <p className="text-xs text-muted-foreground">
                  {overrideEnabled
                    ? "Manual override active."
                    : `Auto-derived using the ${presetLabel} ${selectedReduction}% reduction for your tier, scaled by coverage intensity and alignment.`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Typical {Math.round(reductionConfig.typical * 100)}% · stretch {Math.round(
                    reductionConfig.stretch * 100,
                  )}% reduction bands.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  {(["typical", "stretch"] as CyclePresetKey[]).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant={cyclePreset === mode ? "default" : "outline"}
                      onClick={() => onCyclePresetChange(mode)}
                    >
                      {mode === "typical" ? "Typical" : "Stretch"}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={overrideEnabled ? "destructive" : "outline"}
                  onClick={() => onOverrideChange(!overrideEnabled)}
                >
                  {overrideEnabled ? "Disable override" : "Manual override"}
                </Button>
                <Badge variant={overrideEnabled ? "destructive" : "secondary"}>
                  {overrideEnabled ? "Override" : "Auto"}
                </Badge>
              </div>
            </div>
            <div className="relative">
              <Input
                ref={field.ref}
                name={field.name}
                value={overrideEnabled ? fieldValue : derivedLabel}
                onChange={(event) => field.onChange(numberParser(event.target.value))}
                onBlur={field.onBlur}
                readOnly={!overrideEnabled}
                inputMode="decimal"
                className={cn(
                  "pr-10",
                  !overrideEnabled && "bg-muted/30 text-muted-foreground",
                )}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                mo
              </span>
            </div>
            <FormMessage />
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Baseline {baselineLabel} mo</span>
              <span>Intensity {intensityLabel}</span>
              <span>Δ {reductionLabel}</span>
              <span>Derived {derivedLabel} mo</span>
            </div>
            {warnLowBaseline ? (
              <p className="text-xs text-amber-600">
                Baseline cycle is already under two months. Expect limited acceleration.
              </p>
            ) : null}
          </FormItem>
        );
      }}
    />
  );
}
