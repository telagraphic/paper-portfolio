import type { BookView, ListingView } from "../book/book";

export type PageListing = ListingView & { name: string | null };

export type PageBook = Omit<BookView, "listings"> & { listings: PageListing[] };

export function displayName(listing: { symbol: string; name: string | null }) {
  return distinctName(listing) ?? listing.symbol;
}

export function displaySymbol(listing: { symbol: string; exchange: string }) {
  return listing.exchange === "US" ? listing.symbol : `${listing.symbol}.${listing.exchange}`;
}

export function distinctName(listing: { symbol: string; name: string | null }) {
  const name = listing.name?.trim();
  if (!name || name.toUpperCase() === listing.symbol.toUpperCase()) return null;
  return name;
}

export function latestCloseDate(listings: { bars: { date: string }[] }[]): string | null {
  let latest = "";
  for (const listing of listings) {
    for (const bar of listing.bars) if (bar.date > latest) latest = bar.date;
  }
  return latest || null;
}

export function formatCloseDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}
