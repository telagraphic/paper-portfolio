import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { STARTING_CASH_USD, type Bar, type BookSnapshot, type CashDeposit, type FxClose, type Split, type Trade, type TradeSide } from "../book/book.js";

// Each step raises the book file by one schema version. Append steps; never edit a shipped one.
const MIGRATIONS: ((database: DatabaseSync) => void)[] = [
  (database) => {
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
      CREATE TABLE IF NOT EXISTS setting (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS api_hit (
        day TEXT PRIMARY KEY,
        hits INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS feed_key (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cash_deposit (
        id TEXT PRIMARY KEY,
        recorded_at TEXT NOT NULL,
        usd_amount REAL NOT NULL
      );
    `);

    const bookColumns = database.prepare("PRAGMA table_info(book)").all() as { name: string }[];
    if (!bookColumns.some((column) => column.name === "opening_cash_usd")) {
      database.exec(`ALTER TABLE book ADD COLUMN opening_cash_usd REAL NOT NULL DEFAULT ${STARTING_CASH_USD}`);
    }
    const legacyKey = database.prepare("SELECT value FROM setting WHERE key = 'eodhd_api_key'").get() as
      | { value: string }
      | undefined;
    if (legacyKey?.value) {
      const saved = database.prepare("SELECT 1 FROM feed_key WHERE token = ?").get(legacyKey.value);
      if (!saved) {
        database
          .prepare("INSERT INTO feed_key (id, token, created_at) VALUES (?, ?, ?)")
          .run(randomUUID(), legacyKey.value, new Date().toISOString());
      }
      database.exec("DELETE FROM setting WHERE key = 'eodhd_api_key'");
    }
  },
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export class SchemaTooNewError extends Error {
  constructor(filePath: string, fileVersion: number) {
    super(
      `${filePath} is at schema version ${fileVersion}, but this build only knows version ${SCHEMA_VERSION}. ` +
        "Run a newer image, or restore the backup taken before the update.",
    );
    this.name = "SchemaTooNewError";
  }
}

export type BookStore = {
  read(): BookSnapshot;
  append(trade: Trade): void;
  remove(id: string): void;
  setOpeningCash(usdAmount: number): void;
  addDeposit(deposit: CashDeposit): void;
  saveBars(bars: Bar[]): void;
  saveFx(rows: FxClose[]): void;
  saveSplits(rows: Split[]): void;
  attempts(symbol: string, exchange: string, kind: string): string[];
  markAttempt(symbol: string, exchange: string, kind: string, sessionDate: string): void;
  rememberName(symbol: string, exchange: string, name: string): void;
  names(): Record<string, string>;
  readSetting(key: string): string | null;
  writeSetting(key: string, value: string): void;
  addFeedKey(id: string, token: string, createdAt: string): boolean;
  removeFeedKey(id: string): void;
  feedKeys(): { id: string; hint: string; createdAt: string }[];
  activeFeedKey(): string | null;
  apiHits(day: string): number;
  recordApiHit(day: string): void;
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
  migrate(database, filePath);

  const existing = database.prepare("SELECT created_at FROM book WHERE id = 1").get() as { created_at: string } | undefined;
  if (!existing) {
    database.prepare("INSERT INTO book (id, created_at) VALUES (1, ?)").run(new Date().toISOString());
  }

  const bookStatement = database.prepare("SELECT created_at, opening_cash_usd FROM book WHERE id = 1");
  const updateOpening = database.prepare("UPDATE book SET opening_cash_usd = ? WHERE id = 1");
  const depositsStatement = database.prepare(
    "SELECT id, recorded_at, usd_amount FROM cash_deposit ORDER BY recorded_at, id",
  );
  const insertDeposit = database.prepare("INSERT INTO cash_deposit (id, recorded_at, usd_amount) VALUES (?, ?, ?)");
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
  const readSettingStatement = database.prepare("SELECT value FROM setting WHERE key = ?");
  const writeSettingStatement = database.prepare("INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)");
  const deleteSettingStatement = database.prepare("DELETE FROM setting WHERE key = ?");
  const readHitsStatement = database.prepare("SELECT hits FROM api_hit WHERE day = ?");
  const recordHitStatement = database.prepare(
    "INSERT INTO api_hit (day, hits) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET hits = hits + 1",
  );
  const feedKeysStatement = database.prepare("SELECT id, token, created_at FROM feed_key ORDER BY created_at DESC, id DESC");
  const insertFeedKey = database.prepare("INSERT INTO feed_key (id, token, created_at) VALUES (?, ?, ?)");
  const deleteFeedKey = database.prepare("DELETE FROM feed_key WHERE id = ?");

  return {
    read() {
      const row = bookStatement.get() as { created_at: string; opening_cash_usd: number };
      const deposits = depositsStatement.all() as { id: string; recorded_at: string; usd_amount: number }[];
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
        openingCashUsd: row.opening_cash_usd,
        deposits: deposits.map((deposit) => ({
          id: deposit.id,
          recordedAt: deposit.recorded_at,
          usdAmount: deposit.usd_amount,
        })),
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
    setOpeningCash(usdAmount) {
      updateOpening.run(usdAmount);
    },
    addDeposit(deposit) {
      insertDeposit.run(deposit.id, deposit.recordedAt, deposit.usdAmount);
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
    readSetting(key) {
      const row = readSettingStatement.get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },
    writeSetting(key, value) {
      if (!value) {
        deleteSettingStatement.run(key);
        return;
      }
      writeSettingStatement.run(key, value);
    },
    addFeedKey(id, token, createdAt) {
      const rows = feedKeysStatement.all() as { token: string }[];
      if (rows.some((row) => row.token === token)) return false;
      insertFeedKey.run(id, token, createdAt);
      return true;
    },
    removeFeedKey(id) {
      deleteFeedKey.run(id);
    },
    feedKeys() {
      return (feedKeysStatement.all() as { id: string; token: string; created_at: string }[]).map((row) => ({
        id: row.id,
        hint: row.token.slice(-4),
        createdAt: row.created_at,
      }));
    },
    activeFeedKey() {
      const row = (feedKeysStatement.all() as { token: string }[])[0];
      return row?.token ?? null;
    },
    apiHits(day) {
      const row = readHitsStatement.get(day) as { hits: number } | undefined;
      return row?.hits ?? 0;
    },
    recordApiHit(day) {
      recordHitStatement.run(day);
    },
    close() {
      database.close();
    },
  };
}

function migrate(database: DatabaseSync, filePath: string) {
  const { user_version: fileVersion } = database.prepare("PRAGMA user_version").get() as { user_version: number };
  if (fileVersion > SCHEMA_VERSION) {
    database.close();
    throw new SchemaTooNewError(filePath, fileVersion);
  }
  if (fileVersion === SCHEMA_VERSION) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const step of MIGRATIONS.slice(fileVersion)) step(database);
    database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    database.close();
    throw error;
  }
}
