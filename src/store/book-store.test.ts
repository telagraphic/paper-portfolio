import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { STARTING_CASH_USD, applyTrade, viewBook } from "../book/book.js";
import { openBookStore } from "./book-store.js";

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
});
