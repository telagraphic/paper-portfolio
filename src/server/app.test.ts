import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { STARTING_CASH_USD, viewBook } from "../book/book.js";
import type { QuoteSource } from "../quotes/eodhd.js";
import { openBookStore } from "../store/book-store.js";
import { createApp } from "./app.js";

const directories: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => closeServer(server)));
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("GET /api/health", () => {
  it("answers without touching the feed", async () => {
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const store = openBookStore(join(directory, "book.sqlite"));
    const server = createApp(store, directory, { quotes: quietQuotes() });
    servers.push(server);
    await listen(server);

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP port");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(store.apiHits(new Date().toISOString().slice(0, 10))).toBe(0);
    store.close();
  });
});

describe("GET /api/book", () => {
  it("returns the empty paper portfolio and omits the quote key", async () => {
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const store = openBookStore(join(directory, "book.sqlite"));
    store.addFeedKey("key-1", "secret-eodhd-key", "2026-11-06T00:00:00.000Z");
    const server = createApp(store, directory, { quotes: quietQuotes() });
    servers.push(server);
    await listen(server);

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP port");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/book`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.cashUsd).toBe(STARTING_CASH_USD);
    expect(body.equityUsd).toBe(STARTING_CASH_USD);
    expect(body.listings).toEqual([]);
    expect(body.feedKeySaved).toBe(true);
    expect(JSON.stringify(body)).not.toContain("secret-eodhd-key");
    store.close();
  });

  it("ignores EODHD_API_KEY when no key is saved in Admin", async () => {
    const previous = process.env.EODHD_API_KEY;
    process.env.EODHD_API_KEY = "environment-eodhd-key";
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const store = openBookStore(join(directory, "book.sqlite"));
    const server = createApp(store, directory);
    servers.push(server);
    await listen(server);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP port");

    try {
      const book = await (await fetch(`http://127.0.0.1:${address.port}/api/book`)).json();
      const search = await (
        await fetch(`http://127.0.0.1:${address.port}/api/search`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: "Apple" }),
        })
      ).json();

      expect(book.feedKeySaved).toBe(false);
      expect(search.hits).toEqual([]);
      expect(store.apiHits(new Date().toISOString().slice(0, 10))).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.EODHD_API_KEY;
      else process.env.EODHD_API_KEY = previous;
      store.close();
    }
  });
});

describe("POST /api/trades", () => {
  it("records a manual buy and leaves the quote key out of the response", async () => {
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const store = openBookStore(join(directory, "book.sqlite"));
    store.addFeedKey("key-1", "secret-eodhd-key", "2026-11-06T00:00:00.000Z");
    const server = createApp(store, directory, { quotes: quietQuotes() });
    servers.push(server);
    await listen(server);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP port");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/trades`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        side: "buy",
        symbol: "AAPL",
        exchange: "US",
        tradingCurrency: "USD",
        shares: 10,
        fill: 180,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cashUsd).toBe(98_200);
    expect(body.listings[0].symbol).toBe("AAPL");
    expect(body.activity).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("secret-eodhd-key");

    const again = await fetch(`http://127.0.0.1:${address.port}/api/book`);
    const stored = await again.json();
    expect(stored.cashUsd).toBe(98_200);
    store.close();
  });

  it("refuses a buy that would make cash negative", async () => {
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const store = openBookStore(join(directory, "book.sqlite"));
    const server = createApp(store, directory, { quotes: quietQuotes() });
    servers.push(server);
    await listen(server);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP port");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/trades`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        side: "buy",
        symbol: "AAPL",
        exchange: "US",
        tradingCurrency: "USD",
        shares: 1000,
        fill: 180,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("insufficient-cash");
    expect(viewBook(store.read()).cashUsd).toBe(STARTING_CASH_USD);
    store.close();
  });
});

describe("search, closes, and deletion", () => {
  it("searches once and leaves the quote key out of the response", async () => {
    let calls = 0;
    const quotes = quietQuotes();
    quotes.search = async () => {
      calls += 1;
      return [{ symbol: "7203", exchange: "TSE", name: "Toyota", tradingCurrency: "JPY", previousClose: 2400, previousCloseDate: "2026-10-08" }];
    };
    const { port, store } = await start(quotes);
    store.addFeedKey("key-1", "secret-eodhd-key", "2026-11-06T00:00:00.000Z");
    const response = await fetch(`http://127.0.0.1:${port}/api/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Toyota" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(calls).toBe(1);
    expect(body.hits).toEqual([{ symbol: "7203", exchange: "TSE", name: "Toyota", tradingCurrency: "JPY", previousClose: 2400, previousCloseDate: "2026-10-08" }]);
    expect(JSON.stringify(body)).not.toContain("secret-eodhd-key");
    store.close();
  });

  it("buys at the latest stored close and does not fetch that close again", async () => {
    const calls: string[] = [];
    const quotes = quietQuotes();
    quotes.loadHistory = async (symbol, exchange, from, to) => {
      calls.push(`${symbol}.${exchange}:${from}:${to}`);
      return [
        { symbol, exchange, date: "2026-11-05", open: 180, high: 185, low: 179, close: 182, volume: 10 },
        { symbol, exchange, date: "2026-11-06", open: 182, high: 191, low: 181, close: 190, volume: 12 },
      ];
    };
    const { port, store } = await start(quotes, () => new Date("2026-11-06T21:30:00.000Z"));
    const response = await fetch(`http://127.0.0.1:${port}/api/trades`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ side: "buy", symbol: "AAPL", exchange: "US", tradingCurrency: "USD", shares: 10 }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.activity[0].fill).toBe(190);
    expect(body.listings[0].bars).toHaveLength(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("2025-11-06");

    await fetch(`http://127.0.0.1:${port}/api/book`);
    expect(calls).toHaveLength(1);
    store.close();
  });

  it("remembers a search name and leaves it in place when a trade sends none", async () => {
    const { port, store } = await start(quietQuotes());
    const named = await postTrade(port, {
      side: "buy",
      symbol: "AAPL",
      exchange: "US",
      tradingCurrency: "USD",
      shares: 10,
      fill: 180,
      name: "Apple",
    });
    expect(named.listings[0]?.name).toBe("Apple");

    const kept = await postTrade(port, {
      side: "buy",
      symbol: "AAPL",
      exchange: "US",
      tradingCurrency: "USD",
      shares: 5,
      fill: 190,
    });
    expect(kept.listings[0]?.name).toBe("Apple");

    const replaced = await postTrade(port, {
      side: "buy",
      symbol: "AAPL",
      exchange: "US",
      tradingCurrency: "USD",
      shares: 1,
      fill: 200,
      name: "Apple Inc",
    });
    expect(replaced.listings[0]?.name).toBe("Apple Inc");
    store.close();
  });

  it("refuses to delete a buy that a later sell needs", async () => {
    const { port, store } = await start(quietQuotes());
    const first = await postTrade(port, { side: "buy", symbol: "AAPL", exchange: "US", tradingCurrency: "USD", shares: 10, fill: 100 });
    const second = await postTrade(port, { side: "sell", symbol: "AAPL", exchange: "US", tradingCurrency: "USD", shares: 4, fill: 120 });
    const buyId = first.activity[0].id as string;
    const sellId = second.activity[1].id as string;

    const refused = await fetch(`http://127.0.0.1:${port}/api/trades/${buyId}`, { method: "DELETE" });
    const refusal = await refused.json();
    expect(refused.status).toBe(400);
    expect(refusal.error).toBe("needed-for-sell");
    expect(viewBook(store.read()).cashUsd).toBe(99_480);

    const removed = await fetch(`http://127.0.0.1:${port}/api/trades/${sellId}`, { method: "DELETE" });
    const body = await removed.json();
    expect(removed.status).toBe(200);
    expect(body.cashUsd).toBe(99_000);
    expect(body.activity).toHaveLength(1);
    store.close();
  });

  it("saves a feed key without sending it back", async () => {
    const { port, store } = await start(quietQuotes());
    const saved = await fetch(`http://127.0.0.1:${port}/api/admin`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "fresh-key-1234" }),
    });
    expect(saved.status).toBe(200);
    const body = (await saved.json()) as { keys: { id: string; hint: string; active: boolean }[]; limit: number; used: number };
    expect(body.limit).toBe(20);
    expect(body.used).toBe(0);
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0]).toMatchObject({ hint: "1234", active: true });
    expect(JSON.stringify(body)).not.toContain("fresh-key-1234");
    expect(store.activeFeedKey()).toBe("fresh-key-1234");

    const removed = await fetch(`http://127.0.0.1:${port}/api/admin/keys/${body.keys[0]?.id}`, { method: "DELETE" });
    expect(removed.status).toBe(200);
    expect(store.activeFeedKey()).toBeNull();
    store.close();
  });
});

describe("admin cash", () => {
  it("changes the opening cash and adds cash to the book", async () => {
    const { port, store } = await start(quietQuotes(), () => new Date("2026-11-16T16:00:00.000Z"));
    const opened = await fetch(`http://127.0.0.1:${port}/api/admin/opening`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 120_000 }),
    });
    const openedBody = (await opened.json()) as { openingCashUsd: number; cashUsd: number; equityUsd: number };
    expect(opened.status).toBe(200);
    expect(openedBody).toMatchObject({ openingCashUsd: 120_000, cashUsd: 120_000, equityUsd: 120_000 });

    const added = await fetch(`http://127.0.0.1:${port}/api/admin/cash`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 1_000 }),
    });
    const addedBody = (await added.json()) as { cashUsd: number; equityUsd: number };
    expect(added.status).toBe(200);
    expect(addedBody.cashUsd).toBe(121_000);
    expect(addedBody.equityUsd).toBe(121_000);
    expect(viewBook(store.read()).cashUsd).toBe(121_000);
    store.close();
  });
});

function quietQuotes(): QuoteSource {
  return {
    async search() {
      return [];
    },
    async loadHistory() {
      return [];
    },
    async loadFx() {
      return [];
    },
    async loadSplits() {
      return [];
    },
  };
}

async function start(quotes: QuoteSource, now: () => Date = () => new Date("2026-11-06T21:30:00.000Z")) {
  const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
  directories.push(directory);
  const store = openBookStore(join(directory, "book.sqlite"));
  const server = createApp(store, directory, { quotes, now });
  servers.push(server);
  await listen(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP port");
  return { port: address.port, store };
}

async function postTrade(port: number, body: unknown) {
  const response = await fetch(`http://127.0.0.1:${port}/api/trades`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<{ activity: { id: string }[]; listings: { name: string | null }[] }>;
}

function listen(server: Server) {
  return new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
