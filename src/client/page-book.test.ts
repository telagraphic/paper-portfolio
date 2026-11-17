import { describe, expect, it } from "vitest";
import { displaySymbol, distinctName, formatCloseDate, latestCloseDate } from "./page-book";

describe("listing labels", () => {
  it("shows a US listing once, without the exchange suffix", () => {
    expect(displaySymbol({ symbol: "AAPL", exchange: "US" })).toBe("AAPL");
    expect(distinctName({ symbol: "AAPL", name: "AAPL" })).toBeNull();
    expect(distinctName({ symbol: "AAPL", name: "Apple" })).toBe("Apple");
  });

  it("uses the newest stored close as the update date", () => {
    expect(latestCloseDate([{ bars: [{ date: "2026-11-13" }] }, { bars: [{ date: "2026-11-12" }] }])).toBe("2026-11-13");
    expect(latestCloseDate([{ bars: [] }])).toBeNull();
    expect(formatCloseDate("2026-11-13")).toBe("Nov 13, 2026");
  });

  it("keeps an international suffix once", () => {
    expect(displaySymbol({ symbol: "7203", exchange: "TSE" })).toBe("7203.TSE");
    expect(distinctName({ symbol: "7203", name: "Toyota Motor" })).toBe("Toyota Motor");
  });
});
