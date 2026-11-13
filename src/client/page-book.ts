import type { BookView, ListingView } from "../book/book";

export type PageListing = ListingView & { name: string | null };

export type PageBook = Omit<BookView, "listings"> & { listings: PageListing[] };

export function displayName(listing: { symbol: string; name: string | null }) {
  const name = listing.name?.trim();
  return name ? name : listing.symbol;
}
