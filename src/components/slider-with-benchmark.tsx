"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  baseMin: number;
  baseMax: number;
  stretchMin: number;
  stretchMax: number;
  unit?: "%" | "pp";
  description?: string;
};

const clamp = (min: number, max: number, value: number) =>
  Math.min(max, Math.max(min, value));

export function SliderWithBenchmark({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  baseMin,
  baseMax,
  stretchMin,
  stretchMax,
  unit = "%",
  description,
}: Props) {
  const safeValue = clamp(min, max, Number.isFinite(value) ? value : min);
  const state =
    safeValue < baseMin
      ? "below typical"
      : safeValue <= baseMax
        ? "within typical"
        : safeValue < stretchMin
          ? "above typical"
          : safeValue <= stretchMax
            ? "within stretch"
            : "above stretch";

  const badgeVariant = state.includes("below")
    ? "secondary"
    : state.includes("above stretch")
      ? "destructive"
      : "default";

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = clamp(min, max, Number(event.target.value));
    onChange(Number.isFinite(next) ? next : min);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Number(event.target.value);
    if (Number.isNaN(raw)) {
      onChange(min);
      return;
    }

    onChange(clamp(min, max, raw));
  };

  const toPercent = (n: number) => ((n - min) / (max - min)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        <Badge variant={badgeVariant}>{state}</Badge>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={safeValue}
            onChange={handleSliderChange}
            className="h-2 w-full appearance-none rounded-full bg-muted [accent-color:var(--accent-color,#0f172a)]"
            aria-label={label}
          />
          <div className="relative mt-2 h-2 rounded-full bg-muted">
            <div
              className="absolute h-2 rounded-full bg-muted-foreground/40"
              style={{ left: `${toPercent(baseMin)}%`, width: `${toPercent(baseMax) - toPercent(baseMin)}%` }}
              aria-hidden
            />
            <div
              className="absolute h-2 rounded-full bg-primary/30"
              style={{ left: `${toPercent(stretchMin)}%`, width: `${toPercent(stretchMax) - toPercent(stretchMin)}%` }}
              aria-hidden
            />
            <div
              className="absolute -top-0.5 h-3 w-[2px] rounded bg-foreground"
              style={{ left: `${toPercent(safeValue)}%` }}
              aria-hidden
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            typical {baseMin}
            {unit}–{baseMax}
            {unit} · stretch {stretchMin}
            {unit}–{stretchMax}
            {unit}
          </p>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Input
          value={safeValue}
          onChange={handleInputChange}
          inputMode="decimal"
          className={cn("w-20 text-right")}
          aria-label={`${label} numeric input`}
        />
      </div>
    </div>
  );
}
