import type { Bar, FxClose, Split } from "../book/book.js";

const HOST = "https://eodhd.com/api";
const DIRECT_USD = new Set(["EUR", "GBP", "AUD", "NZD"]);

export type SearchHit = {
  symbol: string;
  exchange: string;
  name: string;
  tradingCurrency: string;
  previousClose: number | null;
  previousCloseDate: string | null;
};

export type QuoteSource = {
  search(query: string): Promise<SearchHit[]>;
  loadHistory(symbol: string, exchange: string, from: string, to: string): Promise<Bar[]>;
  loadFx(currency: string, from: string, to: string): Promise<FxClose[]>;
  loadSplits(symbol: string, exchange: string, from: string): Promise<Split[]>;
};

export function createEodhdSource(
  apiKey: string | (() => string),
  fetchImpl: typeof fetch = fetch,
  onRequest?: () => void,
): QuoteSource {
  const readKey = () => (typeof apiKey === "function" ? apiKey() : apiKey);
  return {
    async search(query) {
      const key = readKey();
      const trimmed = query.trim();
      if (!key || !trimmed) return [];
      onRequest?.();
      const body = await getJson(
        fetchImpl,
        `${HOST}/search/${encodeURIComponent(trimmed)}?api_token=${encodeURIComponent(key)}&limit=15&fmt=json`,
      );
      if (!Array.isArray(body)) return [];
      return body.flatMap(parseHit);
    },
    async loadHistory(symbol, exchange, from, to) {
      const key = readKey();
      if (!key) return [];
      onRequest?.();
      const body = await getJson(fetchImpl, eodUrl(`${symbol}.${exchange}`, from, to, key));
      return parseBars(body, symbol, exchange);
    },
    async loadFx(currency, from, to) {
      const key = readKey();
      if (!key || currency === "USD") return [];
      onRequest?.();
      const pair = fxPair(currency);
      const body = await getJson(fetchImpl, eodUrl(pair.symbol, from, to, key));
      return parseBars(body, pair.symbol, "FOREX")
        .map((bar) => ({
          currency,
          date: bar.date,
          usdPerUnit: pair.invert ? 1 / bar.close : bar.close / pair.divisor,
        }))
        .filter((row) => Number.isFinite(row.usdPerUnit) && row.usdPerUnit > 0);
    },
    async loadSplits(symbol, exchange, from) {
      const key = readKey();
      if (!key) return [];
      onRequest?.();
      const body = await getJson(
        fetchImpl,
        `${HOST}/splits/${encodeURIComponent(`${symbol}.${exchange}`)}?from=${from}&api_token=${encodeURIComponent(key)}&fmt=json`,
      );
      if (!Array.isArray(body)) return [];
      return body.flatMap((row) => parseSplit(row, symbol, exchange));
    },
  };
}

function fxPair(currency: string): { symbol: string; invert: boolean; divisor: number } {
  if (currency === "GBX") return { symbol: "GBPUSD.FOREX", invert: false, divisor: 100 };
  if (DIRECT_USD.has(currency)) return { symbol: `${currency}USD.FOREX`, invert: false, divisor: 1 };
  return { symbol: `USD${currency}.FOREX`, invert: true, divisor: 1 };
}

function eodUrl(ticker: string, from: string, to: string, apiKey: string): string {
  return `${HOST}/eod/${encodeURIComponent(ticker)}?from=${from}&to=${to}&period=d&fmt=json&api_token=${encodeURIComponent(apiKey)}`;
}

async function getJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function parseHit(row: unknown): SearchHit[] {
  if (!row || typeof row !== "object") return [];
  const record = row as Record<string, unknown>;
  const type = String(record.Type ?? "").toLowerCase();
  if (type !== "common stock" && type !== "etf") return [];
  const symbol = String(record.Code ?? "").trim().toUpperCase();
  const exchange = String(record.Exchange ?? "").trim().toUpperCase();
  const tradingCurrency = String(record.Currency ?? "").trim().toUpperCase();
  const name = String(record.Name ?? symbol).trim();
  if (!/^[A-Z0-9]+$/.test(symbol) || !/^[A-Z0-9]+$/.test(exchange) || !/^[A-Z]{3}$/.test(tradingCurrency)) {
    return [];
  }
  const previousClose = Number(record.previousClose);
  const previousCloseDate = String(record.previousCloseDate ?? "");
  return [{
    symbol,
    exchange,
    name,
    tradingCurrency,
    previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : null,
    previousCloseDate: /^\d{4}-\d{2}-\d{2}$/.test(previousCloseDate) ? previousCloseDate : null,
  }];
}

function parseBars(body: unknown, symbol: string, exchange: string): Bar[] {
  if (!Array.isArray(body)) return [];
  const bars: Bar[] = [];
  for (const row of body) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const date = String(record.date ?? "");
    const open = Number(record.open);
    const high = Number(record.high);
    const low = Number(record.low);
    const close = Number(record.close);
    const volume = Number(record.volume ?? 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || ![open, high, low, close].every(Number.isFinite)) continue;
    bars.push({
      symbol,
      exchange,
      date,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
    });
  }
  return bars;
}

function parseSplit(row: unknown, symbol: string, exchange: string): Split[] {
  if (!row || typeof row !== "object") return [];
  const record = row as Record<string, unknown>;
  const date = String(record.date ?? "");
  const [numeratorText, denominatorText] = String(record.split ?? "").split("/");
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || numerator <= 0 || denominator <= 0) return [];
  return [{ symbol, exchange, date, numerator, denominator }];
}
