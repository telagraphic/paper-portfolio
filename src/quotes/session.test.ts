import { describe, expect, it } from "vitest";
import { historyRange, latestFinishedSession, needsHistory } from "./session.js";

describe("latestFinishedSession", () => {
  it("waits until the US cash session has finished", () => {
    expect(latestFinishedSession("US", new Date("2026-11-06T20:30:00.000Z"))).toBe("2026-11-05");
    expect(latestFinishedSession("US", new Date("2026-11-06T21:30:00.000Z"))).toBe("2026-11-06");
  });

  it("uses the Tokyo close for TSE", () => {
    expect(latestFinishedSession("TSE", new Date("2026-11-06T05:00:00.000Z"))).toBe("2026-11-05");
    expect(latestFinishedSession("TSE", new Date("2026-11-06T07:00:00.000Z"))).toBe("2026-11-06");
  });
});

describe("needsHistory", () => {
  it("skips a close that is already stored or already requested", () => {
    expect(needsHistory("2026-11-06", ["2026-11-06"], [])).toBe(false);
    expect(needsHistory("2026-11-06", ["2026-11-05"], ["2026-11-06"])).toBe(false);
    expect(needsHistory("2026-11-06", ["2026-11-05"], [])).toBe(true);
  });

  it("asks for one year the first time and only the missing days after that", () => {
    expect(historyRange("2026-11-06", [])).toEqual({ from: "2025-11-06", to: "2026-11-06" });
    expect(historyRange("2026-11-06", ["2026-11-05"])).toEqual({ from: "2026-11-06", to: "2026-11-06" });
  });
});
