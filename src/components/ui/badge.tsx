"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const variants = {
  default: "inline-flex items-center rounded-full border border-transparent bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary",
  secondary: "inline-flex items-center rounded-full border border-transparent bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
  destructive:
    "inline-flex items-center rounded-full border border-transparent bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive",
  outline:
    "inline-flex items-center rounded-full border border-input px-2 py-0.5 text-xs font-medium text-foreground",
} as const;

export type BadgeVariant = keyof typeof variants;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return <span className={cn(variants[variant], className)} {...props} />;
}
