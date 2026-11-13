const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatUsd(value: number) {
  return money.format(value);
}

export function formatUsdOrBlank(value: number | null) {
  if (value == null) return "—";
  return money.format(value);
}

export function formatSignedUsd(value: number | null) {
  if (value == null) return "—";
  if (value === 0) return money.format(0);
  const body = money.format(Math.abs(value));
  return value > 0 ? `+${body}` : `−${body}`;
}

export function formatSignedTrading(value: number, currency: string) {
  if (value === 0) return formatTrading(0, currency);
  const body = formatTrading(Math.abs(value), currency);
  return value > 0 ? `+${body}` : `−${body}`;
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

export function formatSignedRate(value: number | null) {
  if (value == null) return "—";
  const body = formatRate(Math.abs(value));
  if (value === 0) return body;
  return value > 0 ? `+${body}` : `−${body}`;
}

export function formatSessionDate(recordedAt: string) {
  return recordedAt.slice(0, 10);
}

export function gainTone(value: number | null) {
  if (value == null || value === 0) return undefined;
  return value > 0 ? "up" : "down";
}

export function listingKey(listing: { symbol: string; exchange: string }) {
  return `${listing.symbol}.${listing.exchange}`;
}
