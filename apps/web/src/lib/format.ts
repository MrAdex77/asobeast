import type { Store } from "@asobeast/shared";

const numberFormatter = new Intl.NumberFormat("en-US");
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});
const dayMonthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});
const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const STORE_LABELS: Record<Store, string> = {
  APP_STORE: "App Store",
  GOOGLE_PLAY: "Google Play",
};

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatCompact(value: number): string {
  return compactFormatter.format(value);
}

export function formatRating(value: number): string {
  return value.toFixed(1);
}

export function formatPrice(value: number): string {
  return value === 0 ? "Free" : priceFormatter.format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

export function formatDayMonth(value: string): string {
  return dayMonthFormatter.format(new Date(value));
}

export function formatPosition(value: number | null): string {
  return value === null ? ">100" : String(value);
}

export function formatCategoryPosition(value: number | null): string {
  return value === null ? ">200" : String(value);
}

export function storeLabel(store: Store): string {
  return STORE_LABELS[store];
}

export function formatCountry(code: string): string {
  const upper = code.toUpperCase();
  try {
    return countryNames.of(upper) ?? upper;
  } catch {
    return upper;
  }
}
