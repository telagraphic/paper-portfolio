const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const openedOn = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatUsd(value: number) {
  return money.format(value);
}

export function formatUsdOrBlank(value: number | null) {
  if (value == null) return "—";
  return money.format(value);
}

export function formatOpened(createdAt: string) {
  return openedOn.format(new Date(createdAt));
}

export function formatWhen(recordedAt: string) {
  return openedOn.format(new Date(recordedAt));
}

export function formatShares(shares: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(shares);
}

export function formatTrading(value: number, currency: string) {
  if (currency === "GBX") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}p`;
  }
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
  }
}

export function formatRate(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function gainTone(value: number | null) {
  if (value == null || value === 0) return undefined;
  return value > 0 ? "up" : "down";
}

export function listingKey(listing: { symbol: string; exchange: string }) {
  return `${listing.symbol}.${listing.exchange}`;
}
