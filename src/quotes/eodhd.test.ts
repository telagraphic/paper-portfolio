import { describe, expect, it } from "vitest";
import { createEodhdSource } from "./eodhd.js";

const key = "secret-eodhd-key";

describe("createEodhdSource", () => {
  it("returns stocks and ETFs from one search and keeps two exchanges apart", async () => {
    const calls: string[] = [];
    const quotes = createEodhdSource(key, async (url) => {
      calls.push(String(url));
      return json([
        { Code: "BHP", Exchange: "US", Name: "BHP Group", Type: "Common Stock", Currency: "USD", previousClose: 42.5, previousCloseDate: "2026-11-03" },
        { Code: "BHP", Exchange: "AU", Name: "BHP Group", Type: "Common Stock", Currency: "AUD" },
        { Code: "SPY", Exchange: "US", Name: "SPDR S&P 500", Type: "ETF", Currency: "USD" },
        { Code: "BTC-USD", Exchange: "CC", Name: "Bitcoin", Type: "Crypto", Currency: "USD" },
        { Code: "GSK", Exchange: "LSE", Name: "GSK", Type: "Common Stock", Currency: "GBX" },
      ]);
    });

    const hits = await quotes.search("bhp");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(key);
    expect(JSON.stringify(hits)).not.toContain(key);
    expect(hits.map((hit) => `${hit.symbol}.${hit.exchange}`)).toEqual(["BHP.US", "BHP.AU", "SPY.US", "GSK.LSE"]);
    expect(hits.find((hit) => hit.exchange === "LSE")?.tradingCurrency).toBe("GBX");
    expect(hits.find((hit) => hit.exchange === "US" && hit.symbol === "BHP")).toMatchObject({
      previousClose: 42.5,
      previousCloseDate: "2026-11-03",
    });
    expect(hits.find((hit) => hit.exchange === "AU")?.previousClose).toBeNull();
  });

  it("keeps the traded close rather than the adjusted close", async () => {
    const quotes = createEodhdSource(key, async () =>
      json([{ date: "2026-10-01", open: 90, high: 110, low: 80, close: 100, adjusted_close: 50, volume: 10 }]),
    );
    const bars = await quotes.loadHistory("AAPL", "US", "2025-10-01", "2026-10-01");
    expect(bars[0]).toMatchObject({ close: 100, open: 90, volume: 10 });
  });

  it("converts yen and pence into dollars per unit", async () => {
    const quotes = createEodhdSource(key, async (url) => {
      const address = String(url);
      if (address.includes("USDJPY")) return json([{ date: "2026-10-08", open: 150, high: 150, low: 150, close: 150, volume: 0 }]);
      if (address.includes("GBPUSD")) return json([{ date: "2026-10-08", open: 1.3, high: 1.3, low: 1.3, close: 1.3, volume: 0 }]);
      return json([]);
    });

    expect(await quotes.loadFx("JPY", "2026-10-01", "2026-10-08")).toEqual([
      { currency: "JPY", date: "2026-10-08", usdPerUnit: 1 / 150 },
    ]);
    const gbx = await quotes.loadFx("GBX", "2026-10-01", "2026-10-08");
    expect(gbx[0]?.usdPerUnit).toBeCloseTo(0.013);
  });

  it("reads a split ratio", async () => {
    const quotes = createEodhdSource(key, async () => json([{ date: "2026-10-02", split: "2/1" }]));
    expect(await quotes.loadSplits("AAPL", "US", "2025-10-02")).toEqual([
      { symbol: "AAPL", exchange: "US", date: "2026-10-02", numerator: 2, denominator: 1 },
    ]);
  });

  it("reads a replacement key on the next request and counts the call", async () => {
    const keys = ["first-key-aaaa", "second-key-bbbb"];
    const calls: string[] = [];
    let hits = 0;
    const quotes = createEodhdSource(
      () => keys[0] ?? "",
      async (url) => {
        calls.push(String(url));
        return json([]);
      },
      () => {
        hits += 1;
      },
    );

    await quotes.search("aapl");
    keys.shift();
    await quotes.search("aapl");

    expect(hits).toBe(2);
    expect(calls[0]).toContain("first-key-aaaa");
    expect(calls[1]).toContain("second-key-bbbb");
    expect(calls[0]).not.toContain("second-key-bbbb");
  });

  it("does not call the feed without a key", async () => {
    let called = false;
    const quotes = createEodhdSource("", async () => {
      called = true;
      return json([]);
    });
    expect(await quotes.search("AAPL")).toEqual([]);
    expect(called).toBe(false);
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
