import type { BookStore } from "../store/book-store.js";
import type { QuoteSource } from "../quotes/eodhd.js";
import { historyRange, latestFinishedSession, needsHistory, yearsBefore } from "../quotes/session.js";

export async function refreshBook(store: BookStore, quotes: QuoteSource, now: Date): Promise<void> {
  const snapshot = store.read();
  const listings = new Map<string, { symbol: string; exchange: string; tradingCurrency: string }>();
  for (const trade of snapshot.trades) {
    listings.set(`${trade.symbol}.${trade.exchange}`, {
      symbol: trade.symbol,
      exchange: trade.exchange,
      tradingCurrency: trade.tradingCurrency,
    });
  }

  for (const listing of listings.values()) {
    await ensureHistory(store, quotes, listing.symbol, listing.exchange, now);
    const bars = store.read().bars.filter((bar) => bar.symbol === listing.symbol && bar.exchange === listing.exchange);
    if (bars.length > 0 && store.attempts(listing.symbol, listing.exchange, "splits").length === 0) {
      const finished = latestFinishedSession(listing.exchange, now);
      store.saveSplits(await quotes.loadSplits(listing.symbol, listing.exchange, yearsBefore(finished, 5)));
      store.markAttempt(listing.symbol, listing.exchange, "splits", finished);
    }
  }

  const currencies = new Set(
    [...listings.values()].map((listing) => listing.tradingCurrency).filter((currency) => currency !== "USD"),
  );
  for (const currency of currencies) {
    await ensureFx(store, quotes, currency, now);
  }
}

export async function ensureHistory(
  store: BookStore,
  quotes: QuoteSource,
  symbol: string,
  exchange: string,
  now: Date,
): Promise<void> {
  const finished = latestFinishedSession(exchange, now);
  const stored = store
    .read()
    .bars.filter((bar) => bar.symbol === symbol && bar.exchange === exchange)
    .map((bar) => bar.date);
  const attempted = store.attempts(symbol, exchange, "bars");
  if (!needsHistory(finished, stored, attempted)) return;
  const range = historyRange(finished, stored);
  if (range.from <= range.to) store.saveBars(await quotes.loadHistory(symbol, exchange, range.from, range.to));
  store.markAttempt(symbol, exchange, "bars", finished);
}

export async function ensureFx(store: BookStore, quotes: QuoteSource, currency: string, now: Date): Promise<void> {
  if (currency === "USD") return;
  const finished = latestFinishedSession("US", now);
  const stored = store.read().fxCloses.filter((row) => row.currency === currency).map((row) => row.date);
  const attempted = store.attempts(currency, "FX", "fx");
  if (!needsHistory(finished, stored, attempted)) return;
  const range = historyRange(finished, stored);
  if (range.from <= range.to) store.saveFx(await quotes.loadFx(currency, range.from, range.to));
  store.markAttempt(currency, "FX", "fx", finished);
}

export function fxForTrade(store: BookStore, currency: string, tradeDate: string): number | null {
  if (currency === "USD") return 1;
  const row = store
    .read()
    .fxCloses.filter((close) => close.currency === currency && close.date <= tradeDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  if (!row) return null;
  if (row.date !== tradeDate) store.saveFx([{ currency, date: tradeDate, usdPerUnit: row.usdPerUnit }]);
  return row.usdPerUnit;
}
