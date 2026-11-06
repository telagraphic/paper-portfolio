import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { applyTrade, deleteTrade, viewBook, type TradeInput } from "../book/book.js";
import { createEodhdSource, type QuoteSource } from "../quotes/eodhd.js";
import type { BookStore } from "../store/book-store.js";
import { ensureFx, ensureHistory, fxForTrade, refreshBook } from "./refresh.js";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

type AppOptions = {
  quotes?: QuoteSource;
  now?: () => Date;
};

export function createApp(store: BookStore, clientDir: string, options: AppOptions = {}) {
  const quotes = options.quotes ?? createEodhdSource(process.env.EODHD_API_KEY ?? "");
  const now = options.now ?? (() => new Date());
  let previousStamp = "";
  const recordedAt = () => {
    let stamp = now().toISOString();
    if (stamp <= previousStamp) stamp = new Date(Date.parse(previousStamp) + 1).toISOString();
    previousStamp = stamp;
    return stamp;
  };
  return createServer((request, response) => {
    void handle(store, quotes, now, recordedAt, clientDir, request, response);
  });
}

async function handle(
  store: BookStore,
  quotes: QuoteSource,
  now: () => Date,
  recordedAt: () => string,
  clientDir: string,
  request: IncomingMessage,
  response: ServerResponse,
) {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (url.pathname === "/api/book" && request.method === "GET") {
    await refreshBook(store, quotes, now());
    sendJson(response, 200, viewBook(store.read()));
    return;
  }

  if (url.pathname === "/api/search" && request.method === "POST") {
    const body = await readJson(request);
    const query = body && typeof body === "object" && typeof (body as { query?: unknown }).query === "string"
      ? (body as { query: string }).query
      : "";
    const hits = await quotes.search(query);
    sendJson(response, 200, { hits });
    return;
  }

  if (url.pathname === "/api/trades" && request.method === "POST") {
    const parsed = parseTradeBody(await readJson(request));
    if ("error" in parsed) {
      sendJson(response, 400, parsed);
      return;
    }
    await ensureHistory(store, quotes, parsed.symbol, parsed.exchange, now());
    const fill = parsed.fill ?? latestClose(store, parsed.symbol, parsed.exchange);
    if (fill == null) {
      sendJson(response, 400, { error: "no-close" });
      return;
    }
    await ensureFx(store, quotes, parsed.tradingCurrency, now());
    const tradeDate = now().toISOString().slice(0, 10);
    const usdPerUnit = fxForTrade(store, parsed.tradingCurrency, tradeDate);
    if (usdPerUnit == null) {
      sendJson(response, 400, { error: "fx-required" });
      return;
    }
    const input: TradeInput = {
      id: randomUUID(),
      recordedAt: recordedAt(),
      side: parsed.side,
      symbol: parsed.symbol,
      exchange: parsed.exchange,
      tradingCurrency: parsed.tradingCurrency,
      shares: parsed.shares,
      fill,
      usdPerUnit,
    };
    const result = applyTrade(store.read(), input);
    if ("error" in result) {
      sendJson(response, 400, result);
      return;
    }
    const trade = result.snapshot.trades.at(-1);
    if (!trade) {
      sendJson(response, 400, { error: "invalid" });
      return;
    }
    store.append(trade);
    sendJson(response, 200, viewBook(store.read()));
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/trades/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/trades/".length));
    const result = deleteTrade(store.read(), id);
    if ("error" in result) {
      sendJson(response, result.error === "missing" ? 404 : 400, result);
      return;
    }
    store.remove(id);
    sendJson(response, 200, viewBook(store.read()));
    return;
  }

  if (url.pathname === "/api/book" || url.pathname === "/api/trades" || url.pathname === "/api/search") {
    response.writeHead(405).end("Method not allowed");
    return;
  }

  const filePath = resolveClientFile(clientDir, url.pathname);
  if (!filePath) {
    response.writeHead(404).end("Not found");
    return;
  }

  try {
    const file = await stat(filePath);
    if (!file.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
  } catch {
    response.writeHead(404).end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

function latestClose(store: BookStore, symbol: string, exchange: string): number | null {
  const bars = store
    .read()
    .bars.filter((bar) => bar.symbol === symbol && bar.exchange === exchange)
    .sort((a, b) => a.date.localeCompare(b.date));
  return bars.at(-1)?.close ?? null;
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16_384) return null;
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

function parseTradeBody(body: unknown): { error: "invalid" } | {
  side: "buy" | "sell";
  symbol: string;
  exchange: string;
  tradingCurrency: string;
  shares: number;
  fill: number | null;
} {
  if (!body || typeof body !== "object") return { error: "invalid" };
  const record = body as Record<string, unknown>;
  if (record.side !== "buy" && record.side !== "sell") return { error: "invalid" };
  if (
    typeof record.symbol !== "string" ||
    typeof record.exchange !== "string" ||
    typeof record.tradingCurrency !== "string" ||
    typeof record.shares !== "number"
  ) {
    return { error: "invalid" };
  }
  if (record.fill != null && typeof record.fill !== "number") return { error: "invalid" };
  return {
    side: record.side,
    symbol: record.symbol,
    exchange: record.exchange,
    tradingCurrency: record.tradingCurrency,
    shares: record.shares,
    fill: typeof record.fill === "number" ? record.fill : null,
  };
}

function resolveClientFile(clientDir: string, pathname: string): string | null {
  const root = normalize(clientDir);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const full = normalize(join(root, relative));
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}
