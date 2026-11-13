import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Bar, BookSnapshot, FxClose, Split, Trade, TradeSide } from "../book/book.js";

export type BookStore = {
  read(): BookSnapshot;
  append(trade: Trade): void;
  remove(id: string): void;
  saveBars(bars: Bar[]): void;
  saveFx(rows: FxClose[]): void;
  saveSplits(rows: Split[]): void;
  attempts(symbol: string, exchange: string, kind: string): string[];
  markAttempt(symbol: string, exchange: string, kind: string, sessionDate: string): void;
  rememberName(symbol: string, exchange: string, name: string): void;
  names(): Record<string, string>;
  close(): void;
};

type TradeRow = {
  id: string;
  recorded_at: string;
  side: TradeSide;
  symbol: string;
  exchange: string;
  trading_currency: string;
  shares: number;
  fill: number;
  usd_amount: number;
};

export function openBookStore(filePath: string): BookStore {
  mkdirSync(dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS book (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trade (
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
    CREATE TABLE IF NOT EXISTS bar (
      symbol TEXT NOT NULL,
      exchange TEXT NOT NULL,
      session_date TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      PRIMARY KEY (symbol, exchange, session_date)
    );
    CREATE TABLE IF NOT EXISTS fx_close (
      currency TEXT NOT NULL,
      session_date TEXT NOT NULL,
      usd_per_unit REAL NOT NULL,
      PRIMARY KEY (currency, session_date)
    );
    CREATE TABLE IF NOT EXISTS split (
      symbol TEXT NOT NULL,
      exchange TEXT NOT NULL,
      session_date TEXT NOT NULL,
      numerator REAL NOT NULL,
      denominator REAL NOT NULL,
      PRIMARY KEY (symbol, exchange, session_date)
    );
    CREATE TABLE IF NOT EXISTS feed_check (
      symbol TEXT NOT NULL,
      exchange TEXT NOT NULL,
      kind TEXT NOT NULL,
      session_date TEXT NOT NULL,
      PRIMARY KEY (symbol, exchange, kind, session_date)
    );
    CREATE TABLE IF NOT EXISTS listing_name (
      symbol TEXT NOT NULL,
      exchange TEXT NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (symbol, exchange)
    );
  `);

  const existing = database.prepare("SELECT created_at FROM book WHERE id = 1").get() as { created_at: string } | undefined;
  if (!existing) {
    database.prepare("INSERT INTO book (id, created_at) VALUES (1, ?)").run(new Date().toISOString());
  }

  const createdAtStatement = database.prepare("SELECT created_at FROM book WHERE id = 1");
  const tradesStatement = database.prepare(
    "SELECT id, recorded_at, side, symbol, exchange, trading_currency, shares, fill, usd_amount FROM trade ORDER BY recorded_at, id",
  );
  const barsStatement = database.prepare(
    "SELECT symbol, exchange, session_date, open, high, low, close, volume FROM bar ORDER BY session_date",
  );
  const fxStatement = database.prepare("SELECT currency, session_date, usd_per_unit FROM fx_close ORDER BY session_date");
  const splitsStatement = database.prepare(
    "SELECT symbol, exchange, session_date, numerator, denominator FROM split ORDER BY session_date",
  );
  const insertTrade = database.prepare(
    `INSERT INTO trade (
      id, recorded_at, side, symbol, exchange, trading_currency, shares, fill, usd_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const deleteTradeRow = database.prepare("DELETE FROM trade WHERE id = ?");
  const insertBar = database.prepare(
    `INSERT OR REPLACE INTO bar (symbol, exchange, session_date, open, high, low, close, volume)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertFx = database.prepare(
    "INSERT OR REPLACE INTO fx_close (currency, session_date, usd_per_unit) VALUES (?, ?, ?)",
  );
  const insertSplit = database.prepare(
    `INSERT OR REPLACE INTO split (symbol, exchange, session_date, numerator, denominator)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const attemptStatement = database.prepare(
    "SELECT session_date FROM feed_check WHERE symbol = ? AND exchange = ? AND kind = ? ORDER BY session_date",
  );
  const insertAttempt = database.prepare(
    "INSERT OR REPLACE INTO feed_check (symbol, exchange, kind, session_date) VALUES (?, ?, ?, ?)",
  );
  const namesStatement = database.prepare("SELECT symbol, exchange, name FROM listing_name ORDER BY symbol, exchange");
  const insertName = database.prepare(
    "INSERT OR REPLACE INTO listing_name (symbol, exchange, name) VALUES (?, ?, ?)",
  );

  return {
    read() {
      const row = createdAtStatement.get() as { created_at: string };
      const trades = tradesStatement.all() as TradeRow[];
      const bars = barsStatement.all() as {
        symbol: string;
        exchange: string;
        session_date: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }[];
      const fxCloses = fxStatement.all() as { currency: string; session_date: string; usd_per_unit: number }[];
      const splits = splitsStatement.all() as {
        symbol: string;
        exchange: string;
        session_date: string;
        numerator: number;
        denominator: number;
      }[];
      return {
        createdAt: row.created_at,
        trades: trades.map((trade) => ({
          id: trade.id,
          recordedAt: trade.recorded_at,
          side: trade.side,
          symbol: trade.symbol,
          exchange: trade.exchange,
          tradingCurrency: trade.trading_currency,
          shares: trade.shares,
          fill: trade.fill,
          usdAmount: trade.usd_amount,
        })),
        bars: bars.map((bar) => ({
          symbol: bar.symbol,
          exchange: bar.exchange,
          date: bar.session_date,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
        })),
        fxCloses: fxCloses.map((row) => ({
          currency: row.currency,
          date: row.session_date,
          usdPerUnit: row.usd_per_unit,
        })),
        splits: splits.map((row) => ({
          symbol: row.symbol,
          exchange: row.exchange,
          date: row.session_date,
          numerator: row.numerator,
          denominator: row.denominator,
        })),
      };
    },
    append(trade) {
      insertTrade.run(
        trade.id,
        trade.recordedAt,
        trade.side,
        trade.symbol,
        trade.exchange,
        trade.tradingCurrency,
        trade.shares,
        trade.fill,
        trade.usdAmount,
      );
    },
    remove(id) {
      deleteTradeRow.run(id);
    },
    saveBars(bars) {
      for (const bar of bars) {
        insertBar.run(bar.symbol, bar.exchange, bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume);
      }
    },
    saveFx(rows) {
      for (const row of rows) insertFx.run(row.currency, row.date, row.usdPerUnit);
    },
    saveSplits(rows) {
      for (const row of rows) {
        insertSplit.run(row.symbol, row.exchange, row.date, row.numerator, row.denominator);
      }
    },
    attempts(symbol, exchange, kind) {
      return (attemptStatement.all(symbol, exchange, kind) as { session_date: string }[]).map((row) => row.session_date);
    },
    markAttempt(symbol, exchange, kind, sessionDate) {
      insertAttempt.run(symbol, exchange, kind, sessionDate);
    },
    rememberName(symbol, exchange, name) {
      insertName.run(symbol, exchange, name);
    },
    names() {
      const rows = namesStatement.all() as { symbol: string; exchange: string; name: string }[];
      return Object.fromEntries(rows.map((row) => [`${row.symbol}.${row.exchange}`, row.name]));
    },
    close() {
      database.close();
    },
  };
}
