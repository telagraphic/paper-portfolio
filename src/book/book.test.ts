import { describe, expect, it } from "vitest";
import { applyTrade, deleteTrade, STARTING_CASH_USD, viewBook, type BookSnapshot, type TradeInput } from "./book.js";

const createdAt = "2026-11-03T15:00:00.000Z";

function emptyBook(): BookSnapshot {
  return { createdAt, trades: [], bars: [], fxCloses: [], splits: [] };
}

function trade(overrides: Partial<TradeInput> = {}): TradeInput {
  return {
    id: "t1",
    recordedAt: "2026-11-03T16:00:00.000Z",
    side: "buy",
    symbol: "AAPL",
    exchange: "US",
    tradingCurrency: "USD",
    shares: 10,
    fill: 180,
    ...overrides,
  };
}

function bought(input: TradeInput = trade()): BookSnapshot {
  const result = applyTrade(emptyBook(), input);
  if ("error" in result) throw new Error(result.error);
  return result.snapshot;
}

describe("viewBook", () => {
  it("opens an empty paper portfolio at the starting cash", () => {
    const view = viewBook(emptyBook());

    expect(view.cashUsd).toBe(STARTING_CASH_USD);
    expect(view.equityUsd).toBe(STARTING_CASH_USD);
    expect(view.dayGainUsd).toBe(0);
    expect(view.totalGainUsd).toBe(0);
    expect(view.realizedGainUsd).toBe(0);
    expect(view.listings).toEqual([]);
    expect(view.activity).toEqual([]);
    expect(view.equitySeries).toEqual([{ time: Date.parse(createdAt) / 1000, equityUsd: STARTING_CASH_USD }]);
    expect(view.createdAt).toBe(createdAt);
  });

  it("does not include the quote key in the book view", () => {
    const view = viewBook(emptyBook());

    expect(JSON.stringify(view)).not.toContain("EODHD");
  });
});

describe("applyTrade", () => {
  it("buys whole shares at the manual mark and spends that amount with no commission", () => {
    const result = applyTrade(emptyBook(), trade());
    if ("error" in result) throw new Error(result.error);
    const view = viewBook(result.snapshot);

    expect(view.cashUsd).toBe(98_200);
    expect(view.equityUsd).toBe(100_000);
    expect(view.listings).toEqual([
      expect.objectContaining({
        symbol: "AAPL",
        exchange: "US",
        tradingCurrency: "USD",
        shares: 10,
        averageCost: 180,
        mark: 180,
        marketValueUsd: 1_800,
        totalGainUsd: 0,
        realizedGainUsd: 0,
        dayGainUsd: null,
      }),
    ]);
    expect(view.activity).toEqual([
      expect.objectContaining({ side: "buy", shares: 10, fill: 180, tradingCurrency: "USD" }),
    ]);
    expect(result.snapshot.trades[0]?.usdAmount).toBe(1_800);
  });

  it("refuses a fractional share and leaves the book unchanged", () => {
    const result = applyTrade(emptyBook(), trade({ shares: 1.5 }));

    expect(result).toEqual({ error: "whole-shares" });
  });

  it("refuses a buy that would make cash negative", () => {
    const result = applyTrade(emptyBook(), trade({ shares: 1_000, fill: 180 }));

    expect(result).toEqual({ error: "insufficient-cash" });
  });

  it("weights average cost across buys and marks the position at the latest fill", () => {
    const first = bought(trade({ id: "t1", shares: 10, fill: 100 }));
    const result = applyTrade(
      first,
      trade({ id: "t2", recordedAt: "2026-11-03T17:00:00.000Z", shares: 10, fill: 200 }),
    );
    if ("error" in result) throw new Error(result.error);
    const view = viewBook(result.snapshot);
    const listing = view.listings[0];

    expect(view.cashUsd).toBe(97_000);
    expect(listing?.shares).toBe(20);
    expect(listing?.averageCost).toBe(150);
    expect(listing?.mark).toBe(200);
    expect(listing?.totalGainUsd).toBe(1_000);
    expect(view.equityUsd).toBe(101_000);
  });

  it("sells part of a position without changing average cost", () => {
    const book = bought(trade({ shares: 20, fill: 180 }));
    const result = applyTrade(
      book,
      trade({
        id: "t2",
        recordedAt: "2026-11-03T17:00:00.000Z",
        side: "sell",
        shares: 8,
        fill: 220,
      }),
    );
    if ("error" in result) throw new Error(result.error);
    const view = viewBook(result.snapshot);
    const listing = view.listings[0];

    expect(view.cashUsd).toBe(98_160);
    expect(listing?.shares).toBe(12);
    expect(listing?.averageCost).toBe(180);
    expect(listing?.mark).toBe(220);
    expect(listing?.totalGainUsd).toBe(480);
    expect(listing?.realizedGainUsd).toBe(320);
    expect(view.realizedGainUsd).toBe(320);
    expect(view.equityUsd).toBe(100_800);
  });

  it("keeps a sold-out listing with its realized gain", () => {
    const book = bought(trade({ shares: 10, fill: 400 }));
    const result = applyTrade(
      book,
      trade({
        id: "t2",
        recordedAt: "2026-11-03T17:00:00.000Z",
        side: "sell",
        shares: 10,
        fill: 420,
      }),
    );
    if ("error" in result) throw new Error(result.error);
    const view = viewBook(result.snapshot);

    expect(view.cashUsd).toBe(100_200);
    expect(view.listings[0]).toEqual(
      expect.objectContaining({
        shares: 0,
        dayGainUsd: 0,
        totalGainUsd: 0,
        realizedGainUsd: 200,
      }),
    );
  });

  it("refuses a sell larger than the shares held", () => {
    const book = bought();
    const result = applyTrade(book, trade({ id: "t2", side: "sell", shares: 11, fill: 180 }));

    expect(result).toEqual({ error: "insufficient-shares" });
    expect(viewBook(book).cashUsd).toBe(98_200);
  });

  it("refuses a non-USD fill until an FX close can convert it", () => {
    const result = applyTrade(emptyBook(), trade({ tradingCurrency: "JPY", fill: 2400 }));

    expect(result).toEqual({ error: "fx-required" });
  });
});

describe("closes, FX, and deletion", () => {
  it("leaves day gain blank until a prior close exists, then counts only shares still held", () => {
    const book = bought(trade({ recordedAt: "2026-10-01T15:00:00.000Z", shares: 10, fill: 100 }));
    expect(viewBook(book).listings[0]?.dayGainUsd).toBeNull();

    const marked = {
      ...book,
      bars: [bar("2026-10-01", 100), bar("2026-10-02", 110)],
    };
    const held = viewBook(marked).listings[0];
    expect(held?.dayGainUsd).toBe(100);
    expect(held?.dayReturn).toBeCloseTo(0.1);

    const sold = applyTrade(marked, trade({ id: "t2", recordedAt: "2026-10-02T20:00:00.000Z", side: "sell", shares: 4, fill: 110 }));
    if ("error" in sold) throw new Error(sold.error);
    const remaining = viewBook(sold.snapshot).listings[0];
    expect(remaining?.shares).toBe(6);
    expect(remaining?.dayGainUsd).toBe(60);
    expect(viewBook(sold.snapshot).dayGainUsd).toBe(60);
    expect(viewBook(sold.snapshot).totalGainUsd).not.toBe(viewBook(sold.snapshot).cashUsd);
  });

  it("updates the mark from a later close and keeps the fill", () => {
    const book = bought(trade({ recordedAt: "2026-10-01T15:00:00.000Z", shares: 10, fill: 90 }));
    const view = viewBook({
      ...book,
      bars: [bar("2026-10-01", 100), bar("2026-10-03", 110)],
    });

    expect(view.activity[0]?.fill).toBe(90);
    expect(view.listings[0]?.mark).toBe(110);
    expect(view.listings[0]?.bars.map((candle) => candle.close)).toEqual([100, 110]);
  });

  it("forward-fills a missing close and omits a listing with no FX close", () => {
    const usd = bought(trade({ recordedAt: "2026-10-01T15:00:00.000Z", shares: 10, fill: 90 }));
    const withYen = applyTrade(usd, trade({
      id: "t2",
      recordedAt: "2026-10-08T15:00:00.000Z",
      symbol: "7203",
      exchange: "TSE",
      tradingCurrency: "JPY",
      shares: 100,
      fill: 2400,
      usdPerUnit: 0.0067,
    }));
    if ("error" in withYen) throw new Error(withYen.error);

    const snapshot = {
      ...withYen.snapshot,
      createdAt: "2026-09-30T12:00:00.000Z",
      bars: [
        bar("2026-10-01", 100),
        { symbol: "MSFT", exchange: "US", date: "2026-10-02", open: 50, high: 50, low: 50, close: 50, volume: 1 },
        bar("2026-10-03", 110),
        { symbol: "7203", exchange: "TSE", date: "2026-10-09", open: 2400, high: 2400, low: 2400, close: 2400, volume: 1 },
      ],
      fxCloses: [{ currency: "JPY", date: "2026-10-08", usdPerUnit: 0.0067 }],
    };
    const view = viewBook(snapshot);
    const october2 = view.equitySeries.find((point) => point.time === Date.parse("2026-10-02T23:59:59.000Z") / 1000);
    const october9 = view.equitySeries.find((point) => point.time === Date.parse("2026-10-09T23:59:59.000Z") / 1000);

    expect(october2?.equityUsd).toBe(100_100);
    expect(october9?.equityUsd).toBe(98_592);
    expect(view.listings.find((listing) => listing.symbol === "7203")?.marketValueUsd).toBeNull();
  });

  it("converts a yen buy at the trade-date FX and keeps realized gain when FX moves", () => {
    const boughtYen = applyTrade(emptyBook(), trade({
      recordedAt: "2026-10-08T15:00:00.000Z",
      symbol: "7203",
      exchange: "TSE",
      tradingCurrency: "JPY",
      shares: 100,
      fill: 2400,
      usdPerUnit: 0.0067,
    }));
    if ("error" in boughtYen) throw new Error(boughtYen.error);
    const sold = applyTrade({
      ...boughtYen.snapshot,
      bars: [{ symbol: "7203", exchange: "TSE", date: "2026-10-30", open: 2600, high: 2700, low: 2500, close: 2650, volume: 10 }],
      fxCloses: [
        { currency: "JPY", date: "2026-10-08", usdPerUnit: 0.0067 },
        { currency: "JPY", date: "2026-10-30", usdPerUnit: 0.006 },
      ],
    }, trade({
      id: "t2",
      recordedAt: "2026-10-30T15:00:00.000Z",
      side: "sell",
      symbol: "7203",
      exchange: "TSE",
      tradingCurrency: "JPY",
      shares: 100,
      fill: 2650,
      usdPerUnit: 0.006,
    }));
    if ("error" in sold) throw new Error(sold.error);

    expect(boughtYen.snapshot.trades[0]?.usdAmount).toBe(1608);
    const open = viewBook({
      ...boughtYen.snapshot,
      bars: [{ symbol: "7203", exchange: "TSE", date: "2026-10-30", open: 2600, high: 2700, low: 2500, close: 2650, volume: 10 }],
      fxCloses: [
        { currency: "JPY", date: "2026-10-08", usdPerUnit: 0.0067 },
        { currency: "JPY", date: "2026-10-30", usdPerUnit: 0.006 },
      ],
    });
    expect(open.listings[0]?.totalGain).toBe(25_000);
    expect(open.listings[0]?.totalGainUsd).toBe(-18);
    expect(open.listings[0]?.totalReturn).toBeCloseTo(250 / 2400);

    const later = viewBook({
      ...sold.snapshot,
      fxCloses: [
        ...sold.snapshot.fxCloses,
        { currency: "JPY", date: "2026-11-03", usdPerUnit: 0.009 },
      ],
    });
    expect(later.listings[0]?.realizedGainUsd).toBe(-18);
    expect(later.realizedGainUsd).toBe(-18);
  });

  it("rebuilds the book when a trade is deleted and refuses a buy a later sell needs", () => {
    const book = bought(trade({ shares: 10, fill: 100 }));
    const sold = applyTrade(book, trade({ id: "t2", recordedAt: "2026-11-04T15:00:00.000Z", side: "sell", shares: 4, fill: 120 }));
    if ("error" in sold) throw new Error(sold.error);

    expect(deleteTrade(sold.snapshot, "t1")).toEqual({ error: "needed-for-sell" });
    expect(viewBook(sold.snapshot).cashUsd).toBe(99_480);

    const removed = deleteTrade(sold.snapshot, "t2");
    if ("error" in removed) throw new Error(removed.error);
    const view = viewBook(removed.snapshot);
    expect(view.cashUsd).toBe(99_000);
    expect(view.listings[0]?.shares).toBe(10);
    expect(view.realizedGainUsd).toBe(0);
    expect(view.activity).toHaveLength(1);
  });

  it("doubles shares and halves average cost on a 2-for-1 split without changing value or candles", () => {
    const book = bought(trade({ recordedAt: "2026-10-01T15:00:00.000Z", shares: 10, fill: 100 }));
    const snapshot = {
      ...book,
      bars: [bar("2026-10-01", 100, 100, 100, 90)],
      splits: [{ symbol: "AAPL", exchange: "US", date: "2026-10-02", numerator: 2, denominator: 1 }],
    };
    const view = viewBook(snapshot);
    const listing = view.listings[0];

    expect(listing?.shares).toBe(20);
    expect(listing?.averageCost).toBe(50);
    expect(listing?.mark).toBe(50);
    expect(listing?.marketValueUsd).toBe(1_000);
    expect(listing?.bars[0]?.close).toBe(100);
    expect(listing?.bars[0]?.open).toBe(90);
  });

  it("does not adjust a manual mark when a split has no close to apply", () => {
    const book = bought(trade({ shares: 10, fill: 100 }));
    const view = viewBook({
      ...book,
      splits: [{ symbol: "AAPL", exchange: "US", date: "2026-11-04", numerator: 2, denominator: 1 }],
    });

    expect(view.listings[0]?.shares).toBe(10);
    expect(view.listings[0]?.averageCost).toBe(100);
  });
});

function bar(date: string, close: number, high = close, low = close, open = close) {
  return { symbol: "AAPL", exchange: "US", date, open, high, low, close, volume: 1_000 };
}
