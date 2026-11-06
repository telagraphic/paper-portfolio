const EXCHANGES: Record<string, { timeZone: string; hour: number; minute: number }> = {
  US: { timeZone: "America/New_York", hour: 16, minute: 0 },
  LSE: { timeZone: "Europe/London", hour: 16, minute: 30 },
  XETRA: { timeZone: "Europe/Berlin", hour: 17, minute: 30 },
  TSE: { timeZone: "Asia/Tokyo", hour: 15, minute: 0 },
  AU: { timeZone: "Australia/Sydney", hour: 16, minute: 0 },
  TO: { timeZone: "America/Toronto", hour: 16, minute: 0 },
  HK: { timeZone: "Asia/Hong_Kong", hour: 16, minute: 0 },
  PA: { timeZone: "Europe/Paris", hour: 17, minute: 30 },
  AS: { timeZone: "Europe/Amsterdam", hour: 17, minute: 30 },
  SW: { timeZone: "Europe/Zurich", hour: 17, minute: 30 },
};

const DEFAULT_CLOCK = { timeZone: "America/New_York", hour: 16, minute: 0 };

export function latestFinishedSession(exchange: string, now: Date): string {
  const clock = EXCHANGES[exchange] ?? DEFAULT_CLOCK;
  const parts = zonedParts(now, clock.timeZone);
  const afterClose = parts.hour > clock.hour || (parts.hour === clock.hour && parts.minute >= clock.minute);
  return afterClose ? parts.date : previousDate(parts.date);
}

export function needsHistory(latestFinished: string, storedDates: string[], attempted: string[]): boolean {
  if (storedDates.includes(latestFinished)) return false;
  if (attempted.includes(latestFinished)) return false;
  return true;
}

export function historyRange(latestFinished: string, storedDates: string[]): { from: string; to: string } {
  const last = storedDates.filter((date) => date <= latestFinished).sort().at(-1);
  return { from: last ? nextDate(last) : yearsBefore(latestFinished, 1), to: latestFinished };
}

export function yearsBefore(iso: string, years: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return formatDate(year! - years, month!, day!);
}

function zonedParts(now: Date, timeZone: string): { date: string; hour: number; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: hour === 24 ? 0 : hour,
    minute: Number(parts.minute),
  };
}

function previousDate(iso: string): string {
  return shiftDate(iso, -1);
}

function nextDate(iso: string): string {
  return shiftDate(iso, 1);
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
