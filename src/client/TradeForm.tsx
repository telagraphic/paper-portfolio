import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { BookView, TradeSide } from "../book/book";
import type { SearchHit } from "../quotes/eodhd";
import { formatTrading, formatUsd, listingKey } from "./format";

const errors: Record<string, string> = {
  invalid: "Enter a symbol, an exchange, and a share price.",
  "whole-shares": "Enter a whole number of shares.",
  mark: "Enter a share price above zero.",
  "fx-required": "A non-USD listing needs an FX close before it can change cash.",
  "insufficient-cash": "Not enough cash for this buy.",
  "insufficient-shares": "Not enough shares for this sell.",
  "no-close": "No close is stored for that listing. Enter a share price.",
};

const currencies = ["USD", "EUR", "GBP", "GBX", "JPY", "AUD", "CAD", "CHF", "HKD"];

type TradeMode = "search" | "manual";

type TradeFormProps = {
  cashUsd: number;
  onBook: (book: BookView, selected: string) => void;
};

export function TradeForm({ cashUsd, onBook }: TradeFormProps) {
  const [mode, setMode] = useState<TradeMode>("search");
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [exchange, setExchange] = useState("");
  const [tradingCurrency, setTradingCurrency] = useState("USD");
  const [sharePrice, setSharePrice] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [searchNote, setSearchNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const currencyOptions = currencies.includes(tradingCurrency) ? currencies : [tradingCurrency, ...currencies];

  async function submit(side: TradeSide) {
    setError("");
    setMessage("");
    const fields = readFields({ symbol, shares, exchange, tradingCurrency, sharePrice });
    if ("error" in fields) {
      setError(errors[fields.error] ?? errors.invalid);
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ side, ...fields }),
      });
      const body = (await response.json()) as BookView & { error?: string };
      if (!response.ok) {
        setError(errors[body.error ?? ""] ?? "The trade could not be recorded.");
        return;
      }
      setShares("");
      setMessage(
        side === "buy"
          ? `Bought ${fields.shares.toLocaleString("en-US")} shares of ${fields.symbol}.${fields.exchange}.`
          : `Sold ${fields.shares.toLocaleString("en-US")} shares of ${fields.symbol}.${fields.exchange}.`,
      );
      onBook(body, listingKey(fields));
    } catch {
      setError("The trade could not be recorded.");
    } finally {
      setPending(false);
    }
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void runSearch();
  }

  async function runSearch() {
    const query = symbol.trim();
    if (!query) return;
    setError("");
    setSearchNote("");
    setPending(true);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = (await response.json()) as { hits?: SearchHit[] };
      const next = body.hits ?? [];
      setHits(next);
      setSelectedKey("");
      setSearchNote(next.length === 0 ? "No listing matched. Use Manual to enter a symbol, an exchange, and a share price." : "");
    } catch {
      setSearchNote("Search could not be completed.");
    } finally {
      setPending(false);
    }
  }

  function choose(hit: SearchHit) {
    setSymbol(hit.symbol);
    setExchange(hit.exchange);
    setTradingCurrency(hit.tradingCurrency);
    setSharePrice(hit.previousClose == null ? "" : String(hit.previousClose));
    setSelectedKey(listingKey(hit));
    setSearchNote("");
  }

  function onSymbolChange(value: string) {
    setSymbol(value);
    if (mode !== "search") return;
    setSelectedKey("");
    setSharePrice("");
    setTradingCurrency("USD");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit("buy");
  }

  return (
    <form className="trade-form" onSubmit={onSubmit}>
      <div className="trade-panel">
        <div className="trade-tabs" role="tablist" aria-label="Trade entry">
          <button
            type="button"
            role="tab"
            id="trade-tab-search"
            className="trade-tab"
            aria-selected={mode === "search"}
            aria-controls="trade-panel"
            onClick={() => setMode("search")}
          >
            Search
          </button>
          <button
            type="button"
            role="tab"
            id="trade-tab-manual"
            className="trade-tab"
            aria-selected={mode === "manual"}
            aria-controls="trade-panel"
            onClick={() => setMode("manual")}
          >
            Manual
          </button>
        </div>
        <div
          className="trade-row"
          role="tabpanel"
          id="trade-panel"
          aria-labelledby={mode === "search" ? "trade-tab-search" : "trade-tab-manual"}
        >
          <label className="trade-symbol">
            {mode === "search" ? "Search" : "Symbol"}
            <input
              value={symbol}
              onChange={(event) => onSymbolChange(event.target.value)}
              onKeyDown={mode === "search" ? onSearchKey : undefined}
              placeholder={mode === "search" ? "Apple" : "AAPL"}
              autoComplete="off"
            />
          </label>
          {mode === "search" ? (
            <button type="button" className="trade-sell" disabled={pending} onClick={() => void runSearch()}>
              Search
            </button>
          ) : null}
          <label>
            Exchange
            <input
              value={exchange}
              onChange={(event) => setExchange(event.target.value)}
              placeholder="US"
              autoComplete="off"
            />
          </label>
          {mode === "manual" ? (
            <label>
              Currency
              <select value={tradingCurrency} onChange={(event) => setTradingCurrency(event.target.value)}>
                {currencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="trade-price">
            {mode === "search" && selectedKey ? `Share price, ${tradingCurrency}` : "Share price"}
            <input
              value={sharePrice}
              onChange={(event) => setSharePrice(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          </label>
          <label>
            Shares
            <input
              value={shares}
              onChange={(event) => setShares(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          <button type="submit" disabled={pending}>
            Buy
          </button>
          <button type="button" className="trade-sell" disabled={pending} onClick={() => void submit("sell")}>
            Sell
          </button>
        </div>
        {mode === "search" && hits.length > 0 ? (
          <ul className="search-results">
            {hits.map((hit) => {
              const key = listingKey(hit);
              return (
                <li key={key}>
                  <button type="button" aria-pressed={selectedKey === key} onClick={() => choose(hit)}>
                    <span>{hit.name}</span>
                    <span>{key}</span>
                    <span className="hit-price">
                      {hit.previousClose == null ? "—" : formatTrading(hit.previousClose, hit.tradingCurrency)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {mode === "search" && searchNote ? <p className="trade-note">{searchNote}</p> : null}
      </div>
      <p className="trade-note">Cash {formatUsd(cashUsd)}</p>
      {error ? (
        <p className="trade-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="trade-status" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function readFields(fields: {
  symbol: string;
  shares: string;
  exchange: string;
  tradingCurrency: string;
  sharePrice: string;
}):
  | { error: "invalid" | "whole-shares" | "mark" }
  | { symbol: string; exchange: string; tradingCurrency: string; shares: number; fill: number } {
  const symbol = fields.symbol.trim();
  const exchange = fields.exchange.trim();
  if (!symbol || !exchange) return { error: "invalid" };

  const shares = Number(fields.shares);
  if (!Number.isInteger(shares) || shares < 1) return { error: "whole-shares" };
  const fill = Number(fields.sharePrice);
  if (!Number.isFinite(fill) || fill <= 0) return { error: "mark" };

  return {
    symbol,
    exchange,
    tradingCurrency: fields.tradingCurrency,
    shares,
    fill,
  };
}
