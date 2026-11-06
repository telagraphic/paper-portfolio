export const STARTING_CASH_USD = 100_000;

export type TradeSide = "buy" | "sell";

export type Trade = {
  id: string;
  recordedAt: string;
  side: TradeSide;
  symbol: string;
  exchange: string;
  tradingCurrency: string;
  shares: number;
  fill: number;
  usdAmount: number;
};

export type Bar = {
  symbol: string;
  exchange: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type FxClose = {
  currency: string;
  date: string;
  usdPerUnit: number;
};

export type Split = {
  symbol: string;
  exchange: string;
  date: string;
  numerator: number;
  denominator: number;
};

export type BookSnapshot = {
  createdAt: string;
  trades: Trade[];
  bars: Bar[];
  fxCloses: FxClose[];
  splits: Split[];
};

export type TradeInput = {
  id: string;
  recordedAt: string;
  side: TradeSide;
  symbol: string;
  exchange: string;
  tradingCurrency: string;
  shares: number;
  fill: number;
  usdPerUnit?: number;
};

export type BookError =
  | "invalid"
  | "whole-shares"
  | "mark"
  | "fx-required"
  | "insufficient-cash"
  | "insufficient-shares";

export type DeleteError = "missing" | "needed-for-sell" | "depends";

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ListingView = {
  symbol: string;
  exchange: string;
  tradingCurrency: string;
  shares: number;
  averageCost: number;
  mark: number;
  marketValueUsd: number | null;
  weight: number | null;
  dayGainUsd: number | null;
  totalGain: number;
  totalGainUsd: number | null;
  realizedGainUsd: number;
  dayReturn: number | null;
  totalReturn: number | null;
  bars: Candle[];
};

export type ActivityView = {
  id: string;
  recordedAt: string;
  side: TradeSide;
  symbol: string;
  exchange: string;
  tradingCurrency: string;
  shares: number;
  fill: number;
};

export type EquityPoint = {
  time: number;
  equityUsd: number;
};

export type BookView = {
  cashUsd: number;
  equityUsd: number;
  dayGainUsd: number | null;
  totalGainUsd: number | null;
  realizedGainUsd: number;
  listings: ListingView[];
  activity: ActivityView[];
  equitySeries: EquityPoint[];
  createdAt: string;
};

type Position = {
  symbol: string;
  exchange: string;
  tradingCurrency: string;
  shares: number;
  fillCost: number;
  costCents: number;
  averageCost: number;
  lastFill: number;
  lastFillDate: string;
  realizedCents: number;
  firstAt: string;
};

export function viewBook(snapshot: BookSnapshot): BookView {
  const state = evolve(snapshot, null);
  if (state.error) throw new Error(state.error);
  const listings = listingsFrom(snapshot, state, latestDate(snapshot));
  const equityCents = equityCentsFrom(state.cashCents, listings);
  return {
    cashUsd: dollars(state.cashCents),
    equityUsd: dollars(equityCents),
    dayGainUsd: sumOrNull(listings, (listing) => listing.dayGainUsd),
    totalGainUsd: sumOrNull(listings, (listing) => listing.totalGainUsd),
    realizedGainUsd: dollars(
      [...state.positions.values()].reduce((sum, position) => sum + position.realizedCents, 0),
    ),
    listings: listings.map((listing) => ({
      ...listing,
      weight:
        listing.marketValueUsd == null || equityCents === 0
          ? null
          : cents(listing.marketValueUsd) / equityCents,
    })),
    activity: snapshot.trades.map(toActivity),
    equitySeries: equitySeries(snapshot),
    createdAt: snapshot.createdAt,
  };
}

export function applyTrade(
  snapshot: BookSnapshot,
  input: TradeInput,
): { snapshot: BookSnapshot } | { error: BookError } {
  const trade = tradeFromInput(input);
  if ("error" in trade) return trade;
  const next = { ...snapshot, trades: [...snapshot.trades, trade] };
  const replay = evolve(next, null);
  if (replay.error) return { error: replay.error };
  return { snapshot: next };
}

export function deleteTrade(
  snapshot: BookSnapshot,
  id: string,
): { snapshot: BookSnapshot } | { error: DeleteError } {
  if (!snapshot.trades.some((trade) => trade.id === id)) return { error: "missing" };
  const next = { ...snapshot, trades: snapshot.trades.filter((trade) => trade.id !== id) };
  const replay = evolve(next, null);
  if (replay.error === "insufficient-shares") return { error: "needed-for-sell" };
  if (replay.error) return { error: "depends" };
  return { snapshot: next };
}

function tradeFromInput(input: TradeInput): Trade | { error: BookError } {
  const symbol = input.symbol.trim().toUpperCase();
  const exchange = input.exchange.trim().toUpperCase();
  const tradingCurrency = input.tradingCurrency.trim().toUpperCase();
  if (!/^[A-Z0-9]+$/.test(symbol) || !/^[A-Z0-9]+$/.test(exchange)) return { error: "invalid" };
  if (!/^[A-Z]{3}$/.test(tradingCurrency)) return { error: "invalid" };
  if (!Number.isInteger(input.shares) || input.shares < 1) return { error: "whole-shares" };
  if (!Number.isFinite(input.fill) || input.fill <= 0) return { error: "mark" };

  const usdPerUnit = input.usdPerUnit ?? (tradingCurrency === "USD" ? 1 : undefined);
  if (usdPerUnit == null || !Number.isFinite(usdPerUnit) || usdPerUnit <= 0) return { error: "fx-required" };

  return {
    id: input.id,
    recordedAt: input.recordedAt,
    side: input.side,
    symbol,
    exchange,
    tradingCurrency,
    shares: input.shares,
    fill: input.fill,
    usdAmount: dollars(cents(input.shares * input.fill * usdPerUnit)),
  };
}

function evolve(snapshot: BookSnapshot, asOf: string | null): { error?: BookError; cashCents: number; positions: Map<string, Position> } {
  const limit = asOf ?? "9999-12-31";
  let cashCents = cents(STARTING_CASH_USD);
  const positions = new Map<string, Position>();
  const listingsWithBars = new Set(
    snapshot.bars.filter((bar) => bar.date <= limit).map((bar) => listingKey(bar)),
  );
  const events: { date: string; order: number; time: string; run: () => BookError | null }[] = [];

  for (const trade of snapshot.trades) {
    const date = dateOf(trade.recordedAt);
    if (date > limit) continue;
    events.push({
      date,
      order: 1,
      time: trade.recordedAt,
      run: () => applyStoredTrade(trade, positions, (next) => {
        cashCents = next;
      }, () => cashCents),
    });
  }

  for (const split of snapshot.splits) {
    if (split.date > limit || !listingsWithBars.has(listingKey(split))) continue;
    if (split.numerator <= 0 || split.denominator <= 0) continue;
    events.push({
      date: split.date,
      order: 0,
      time: split.date,
      run: () => {
        const position = positions.get(listingKey(split));
        if (!position || position.shares <= 0) return null;
        position.shares *= split.numerator / split.denominator;
        position.averageCost = position.fillCost / position.shares;
        return null;
      },
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.time.localeCompare(b.time));
  for (const event of events) {
    const error = event.run();
    if (error) return { error, cashCents, positions };
  }
  return { cashCents, positions };
}

function applyStoredTrade(
  trade: Trade,
  positions: Map<string, Position>,
  setCash: (cents: number) => void,
  getCash: () => number,
): BookError | null {
  const key = listingKey(trade);
  const position = positions.get(key);
  const amountCents = cents(trade.usdAmount);
  const date = dateOf(trade.recordedAt);

  if (trade.side === "buy") {
    if (amountCents > getCash()) return "insufficient-cash";
    setCash(getCash() - amountCents);
    if (position && position.tradingCurrency !== trade.tradingCurrency) return "invalid";
    if (position) {
      position.shares += trade.shares;
      position.fillCost += trade.shares * trade.fill;
      position.costCents += amountCents;
      position.averageCost = position.fillCost / position.shares;
      position.lastFill = trade.fill;
      position.lastFillDate = date;
    } else {
      positions.set(key, {
        symbol: trade.symbol,
        exchange: trade.exchange,
        tradingCurrency: trade.tradingCurrency,
        shares: trade.shares,
        fillCost: trade.shares * trade.fill,
        costCents: amountCents,
        averageCost: trade.fill,
        lastFill: trade.fill,
        lastFillDate: date,
        realizedCents: 0,
        firstAt: trade.recordedAt,
      });
    }
    return null;
  }

  if (position && position.tradingCurrency !== trade.tradingCurrency) return "invalid";
  if (!position || trade.shares > position.shares + 1e-6) return "insufficient-shares";
  const full = position.shares - trade.shares <= 1e-6;
  const removedCost = full ? position.costCents : Math.round((position.costCents * trade.shares) / position.shares);
  const removedFill = full ? position.fillCost : (position.fillCost * trade.shares) / position.shares;
  position.shares = full ? 0 : position.shares - trade.shares;
  position.fillCost = full ? 0 : position.fillCost - removedFill;
  position.costCents -= removedCost;
  position.realizedCents += amountCents - removedCost;
  position.lastFill = trade.fill;
  position.lastFillDate = date;
  setCash(getCash() + amountCents);
  return null;
}

function listingsFrom(snapshot: BookSnapshot, state: { cashCents: number; positions: Map<string, Position> }, asOf: string | null): ListingView[] {
  return [...state.positions.values()]
    .sort((a, b) => a.firstAt.localeCompare(b.firstAt))
    .map((position) => toListing(snapshot, position, asOf));
}

function toListing(snapshot: BookSnapshot, position: Position, asOf: string | null): ListingView {
  const limit = asOf ?? "9999-12-31";
  const priced = priceAt(snapshot, position, limit);
  const open = position.shares > 1e-9;
  const fx = fxOn(snapshot, position.tradingCurrency, asOf ?? priced.markDate);
  const priorFx = priced.priorDate ? fxOn(snapshot, position.tradingCurrency, priced.priorDate) : null;
  const marketValueUsd = !open ? 0 : fx == null ? null : dollars(cents(position.shares * priced.mark * fx));
  const totalGain = open ? position.shares * priced.mark - position.fillCost : 0;
  const totalGainUsd = !open ? 0 : marketValueUsd == null ? null : dollars(cents(marketValueUsd) - position.costCents);
  const dayGainUsd = !open
    ? 0
    : priced.prior == null || fx == null || priorFx == null
      ? null
      : dollars(cents(position.shares * priced.mark * fx - position.shares * priced.prior * priorFx));

  return {
    symbol: position.symbol,
    exchange: position.exchange,
    tradingCurrency: position.tradingCurrency,
    shares: position.shares,
    averageCost: position.averageCost,
    mark: priced.mark,
    marketValueUsd,
    weight: null,
    dayGainUsd,
    totalGain,
    totalGainUsd,
    realizedGainUsd: dollars(position.realizedCents),
    dayReturn: !open || priced.prior == null || priced.prior === 0 ? null : (priced.mark - priced.prior) / priced.prior,
    totalReturn: !open || position.averageCost === 0 ? null : (priced.mark - position.averageCost) / position.averageCost,
    bars: snapshot.bars
      .filter((bar) => bar.symbol === position.symbol && bar.exchange === position.exchange)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((bar) => ({
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      })),
  };
}

function priceAt(snapshot: BookSnapshot, position: Position, limit: string): { mark: number; prior: number | null; markDate: string; priorDate: string | null } {
  const bars = snapshot.bars
    .filter((bar) => bar.symbol === position.symbol && bar.exchange === position.exchange && bar.date <= limit)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (bars.length === 0) {
    return { mark: position.lastFill, prior: null, markDate: position.lastFillDate, priorDate: null };
  }
  const latest = bars[bars.length - 1];
  const prior = bars.length > 1 ? bars[bars.length - 2] : undefined;
  if (!latest) return { mark: position.lastFill, prior: null, markDate: position.lastFillDate, priorDate: null };
  return {
    mark: adjustClose(snapshot, position, latest.close, latest.date, limit),
    prior: prior ? adjustClose(snapshot, position, prior.close, prior.date, limit) : null,
    markDate: latest.date,
    priorDate: prior?.date ?? null,
  };
}

function adjustClose(snapshot: BookSnapshot, position: Position, close: number, barDate: string, limit: string): number {
  let ratio = 1;
  for (const split of snapshot.splits) {
    if (split.symbol !== position.symbol || split.exchange !== position.exchange) continue;
    if (split.date > barDate && split.date <= limit && split.denominator > 0) {
      ratio *= split.numerator / split.denominator;
    }
  }
  return close / ratio;
}

function equitySeries(snapshot: BookSnapshot): EquityPoint[] {
  const created = dateOf(snapshot.createdAt);
  const dates = new Set<string>();
  for (const bar of snapshot.bars) if (bar.date >= created) dates.add(bar.date);
  for (const trade of snapshot.trades) {
    const date = dateOf(trade.recordedAt);
    if (date >= created) dates.add(date);
  }
  for (const split of snapshot.splits) if (split.date >= created) dates.add(split.date);
  const points = [...dates].sort().map((date) => ({
    time: Date.parse(`${date}T23:59:59.000Z`) / 1000,
    equityUsd: equityOn(snapshot, date),
  }));
  const openingTime = Math.floor(Date.parse(snapshot.createdAt) / 1000);
  const earliest = points[0]?.time;
  return [{ time: earliest != null && earliest <= openingTime ? earliest - 60 : openingTime, equityUsd: STARTING_CASH_USD }, ...points];
}

function equityOn(snapshot: BookSnapshot, date: string): number {
  const state = evolve(snapshot, date);
  if (state.error) return dollars(state.cashCents);
  let total = state.cashCents;
  for (const position of state.positions.values()) {
    if (position.shares <= 1e-9) continue;
    const priced = priceAt(snapshot, position, date);
    const fx = fxOn(snapshot, position.tradingCurrency, date);
    if (fx == null) continue;
    total += cents(position.shares * priced.mark * fx);
  }
  return dollars(total);
}

function equityCentsFrom(cashCents: number, listings: ListingView[]): number {
  return listings.reduce((sum, listing) => sum + (listing.marketValueUsd == null ? 0 : cents(listing.marketValueUsd)), cashCents);
}

function sumOrNull(listings: ListingView[], read: (listing: ListingView) => number | null): number | null {
  const open = listings.filter((listing) => listing.shares > 1e-9);
  if (open.length === 0) return 0;
  if (open.some((listing) => read(listing) == null)) return null;
  return dollars(open.reduce((sum, listing) => sum + cents(read(listing) ?? 0), 0));
}

function fxOn(snapshot: BookSnapshot, currency: string, date: string): number | null {
  if (currency === "USD") return 1;
  const matches = snapshot.fxCloses.filter((row) => row.currency === currency && row.date === date);
  return matches.at(-1)?.usdPerUnit ?? null;
}

function toActivity(trade: Trade): ActivityView {
  return {
    id: trade.id,
    recordedAt: trade.recordedAt,
    side: trade.side,
    symbol: trade.symbol,
    exchange: trade.exchange,
    tradingCurrency: trade.tradingCurrency,
    shares: trade.shares,
    fill: trade.fill,
  };
}

function listingKey(row: { symbol: string; exchange: string }): string {
  return `${row.symbol}.${row.exchange}`;
}

function latestDate(snapshot: BookSnapshot): string {
  let latest = "";
  for (const bar of snapshot.bars) if (bar.date > latest) latest = bar.date;
  for (const trade of snapshot.trades) {
    const date = dateOf(trade.recordedAt);
    if (date > latest) latest = date;
  }
  for (const split of snapshot.splits) if (split.date > latest) latest = split.date;
  return latest || dateOf(snapshot.createdAt);
}

function dateOf(iso: string): string {
  return iso.slice(0, 10);
}

function cents(amount: number): number {
  return Math.round(amount * 100);
}

function dollars(centsAmount: number): number {
  return centsAmount / 100;
}
