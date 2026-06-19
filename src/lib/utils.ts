import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as GBP currency. */
export function formatGBP(
  amount: number | null | undefined,
  opts: { signed?: boolean; compact?: boolean } = {},
): string {
  const value = amount ?? 0;
  const formatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: opts.compact ? 0 : 2,
    maximumFractionDigits: opts.compact ? 0 : 2,
    notation: opts.compact ? "compact" : "standard",
  });
  const formatted = formatter.format(Math.abs(value));
  if (opts.signed) {
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
  }
  return value < 0 ? `-${formatted}` : formatted;
}

/** Format a percentage value (0-100). */
export function formatPct(value: number | null | undefined, digits = 0): string {
  return `${(value ?? 0).toFixed(digits)}%`;
}

/** ISO date (yyyy-mm-dd) helpers. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(date: string | Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Stable, dependency-free id generator. */
export function genId(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${rand}`;
}

/** Naive checksum for duplicate-upload detection in the mock pipeline. */
export function quickChecksum(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `chk_${(hash >>> 0).toString(16)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function titleCase(input: string): string {
  return input
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
