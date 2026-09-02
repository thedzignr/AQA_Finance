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

/** Whole days from `from` until an ISO date (negative if already past). */
export function daysUntil(iso: string, from: string = todayISO()): number {
  const ms = new Date(iso + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime();
  return Math.round(ms / 86_400_000);
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

/** UUID for Postgres primary keys. */
export function newId(): string {
  return crypto.randomUUID();
}

export function roundMoney(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the ISO week containing `from`. */
export function startOfWeekISO(from: string = todayISO()): string {
  const d = new Date(from + "T00:00:00");
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function weekDatesISO(from: string = todayISO()): string[] {
  const start = startOfWeekISO(from);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
