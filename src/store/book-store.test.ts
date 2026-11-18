import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { STARTING_CASH_USD, applyTrade, viewBook } from "../book/book.js";
import { SCHEMA_VERSION, SchemaTooNewError, openBookStore } from "./book-store.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("openBookStore", () => {
  it("keeps the same book when the file is opened again", () => {
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const filePath = join(directory, "book.sqlite");

    const first = openBookStore(filePath);
    const createdAt = first.read().createdAt;
    first.close();

    const second = openBookStore(filePath);
    expect(second.read().createdAt).toBe(createdAt);
    second.close();
  });

  it("keeps a buy when the file is opened again", () => {
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const filePath = join(directory, "book.sqlite");

    const first = openBookStore(filePath);
    const result = applyTrade(first.read(), {
      id: "t1",
      recordedAt: "2026-11-03T16:00:00.000Z",
      side: "buy",
      symbol: "AAPL",
      exchange: "US",
      tradingCurrency: "USD",
      shares: 10,
      fill: 180,
    });
    if ("error" in result) throw new Error(result.error);
    const trade = result.snapshot.trades[0];
    if (!trade) throw new Error("Expected a trade");
    first.append(trade);
    first.close();

    const second = openBookStore(filePath);
    expect(viewBook(second.read()).cashUsd).toBe(98_200);
    expect(viewBook(second.read()).listings[0]?.symbol).toBe("AAPL");
    second.close();
  });

  it("replaces a remembered name and keeps it across a reopen", () => {
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const filePath = join(directory, "book.sqlite");

    const first = openBookStore(filePath);
    first.rememberName("7203", "TSE", "Toyota");
    first.rememberName("7203", "TSE", "Toyota Motor");
    first.close();

    const second = openBookStore(filePath);
    expect(second.names()["7203.TSE"]).toBe("Toyota Motor");
    second.close();
  });

  it("keeps a saved feed key and the day's request count", () => {
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const filePath = join(directory, "book.sqlite");

    const first = openBookStore(filePath);
    first.addFeedKey("older", "older-key-1111", "2026-11-16T12:00:00.000Z");
    first.addFeedKey("newer", "fresh-key-1234", "2026-11-16T13:00:00.000Z");
    first.recordApiHit("2026-11-16");
    first.recordApiHit("2026-11-16");
    first.close();

    const second = openBookStore(filePath);
    expect(second.activeFeedKey()).toBe("fresh-key-1234");
    expect(second.feedKeys().map((key) => key.hint)).toEqual(["1234", "1111"]);
    expect(second.apiHits("2026-11-16")).toBe(2);
    second.removeFeedKey("newer");
    expect(second.activeFeedKey()).toBe("older-key-1111");
    second.removeFeedKey("older");
    expect(second.activeFeedKey()).toBeNull();
    second.close();
  });

  it("keeps a changed opening cash and added cash", () => {
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const filePath = join(directory, "book.sqlite");

    const first = openBookStore(filePath);
    expect(first.read().openingCashUsd).toBe(STARTING_CASH_USD);
    first.setOpeningCash(125_000);
    first.addDeposit({ id: "d1", recordedAt: "2026-11-16T15:00:00.000Z", usdAmount: 2_500 });
    first.close();

    const second = openBookStore(filePath);
    const view = viewBook(second.read());
    expect(view.openingCashUsd).toBe(125_000);
    expect(view.cashUsd).toBe(127_500);
    second.close();
  });

  it("stamps a new file with the current schema version", () => {
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const filePath = join(directory, "book.sqlite");

    openBookStore(filePath).close();

    const raw = new DatabaseSync(filePath);
    expect(raw.prepare("PRAGMA user_version").get()).toEqual({ user_version: SCHEMA_VERSION });
    raw.close();
  });

  it("upgrades a file written before the schema had a version", () => {
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const filePath = join(directory, "book.sqlite");

    const raw = new DatabaseSync(filePath);
    raw.exec(`
      CREATE TABLE book (id INTEGER PRIMARY KEY CHECK (id = 1), created_at TEXT NOT NULL);
      INSERT INTO book (id, created_at) VALUES (1, '2026-11-01T00:00:00.000Z');
      CREATE TABLE trade (
        id TEXT PRIMARY KEY,
        recorded_at TEXT NOT NULL,
        side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
        symbol TEXT NOT NULL,
        exchange TEXT NOT NULL,
        trading_currency TEXT NOT NULL,
        shares INTEGER NOT NULL,
        fill REAL NOT NULL,
        usd_amount REAL NOT NULL
      );
      INSERT INTO trade VALUES ('t1', '2026-11-03T16:00:00.000Z', 'buy', 'AAPL', 'US', 'USD', 10, 180, 1800);
      CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO setting VALUES ('eodhd_api_key', 'legacy-key-9999');
    `);
    raw.close();

    const store = openBookStore(filePath);
    expect(store.read().createdAt).toBe("2026-11-01T00:00:00.000Z");
    expect(viewBook(store.read()).cashUsd).toBe(98_200);
    expect(store.activeFeedKey()).toBe("legacy-key-9999");
    expect(store.readSetting("eodhd_api_key")).toBeNull();
    store.close();
  });

  it("refuses a file from a newer build and leaves it untouched", () => {
    const directory = mkdtempSync(join(tmpdir(), "paper-portfolio-"));
    directories.push(directory);
    const filePath = join(directory, "book.sqlite");

    openBookStore(filePath).close();
    const raw = new DatabaseSync(filePath);
    raw.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    raw.close();

    expect(() => openBookStore(filePath)).toThrow(SchemaTooNewError);

    const after = new DatabaseSync(filePath);
    expect(after.prepare("PRAGMA user_version").get()).toEqual({ user_version: SCHEMA_VERSION + 1 });
    after.close();
  });
});
