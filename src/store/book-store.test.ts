import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyTrade, viewBook } from "../book/book.js";
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
});
