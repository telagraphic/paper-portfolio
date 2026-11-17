import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { TradeSide } from "../book/book";
import { displaySymbol, type PageBook } from "./page-book";
import type { SearchHit } from "../quotes/eodhd";
import { formatTrading, formatUsd, listingKey } from "./format";
import { MorphValue } from "./MorphValue";

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
  onBook: (book: PageBook, selected: string) => void;
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
  const [busy, setBusy] = useState<null | "search" | TradeSide>(null);

  const currencyOptions = currencies.includes(tradingCurrency) ? currencies : [tradingCurrency, ...currencies];
  const total = orderTotal(sharePrice, shares);

  async function submit(side: TradeSide) {
    setError("");
    setMessage("");
    const fields = readFields({ symbol, shares, exchange, tradingCurrency, sharePrice });
    if ("error" in fields) {
      setError(errors[fields.error] ?? errors.invalid);
      return;
    }

    const chosen = hits.find((hit) => listingKey(hit) === selectedKey);
    const name =
      mode === "search" && chosen && chosen.symbol === fields.symbol && chosen.exchange === fields.exchange
        ? chosen.name
        : undefined;
    setBusy(side);
    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ side, ...fields, ...(name ? { name } : {}) }),
      });
      const body = (await response.json()) as PageBook & { error?: string };
      if (!response.ok) {
        setError(errors[body.error ?? ""] ?? "The trade could not be recorded.");
        return;
      }
      setShares("");
      setMessage(
        side === "buy"
          ? `Bought ${fields.shares.toLocaleString("en-US")} shares of ${displaySymbol(fields)}.`
          : `Sold ${fields.shares.toLocaleString("en-US")} shares of ${displaySymbol(fields)}.`,
      );
      onBook(body, listingKey(fields));
    } catch {
      setError("The trade could not be recorded.");
    } finally {
      setBusy(null);
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
    setBusy("search");
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
      setBusy(null);
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
    <form className="trade-form" onSubmit={onSubmit} aria-busy={busy !== null}>
      <section className="book-figures trade-figures" aria-label="Order">
        <dl>
          <div>
            <dt>Cash</dt>
            <dd>
              <MorphValue>{formatUsd(cashUsd)}</MorphValue>
            </dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd data-empty={total == null ? "true" : undefined}>
              {total == null ? "—" : formatTrading(total, tradingCurrency)}
            </dd>
          </div>
        </dl>
      </section>
      <div className="trade-panel">
        <Segmented
          label="Trade entry"
          value={mode}
          tabs
          choices={[
            { id: "search", label: "Search" },
            { id: "manual", label: "Manual" },
          ]}
          onChange={(id) => setMode(id as TradeMode)}
        />
        <div
          className="trade-row"
          role="tabpanel"
          id="trade-panel"
          aria-labelledby={mode === "search" ? "trade-tab-search" : "trade-tab-manual"}
        >
          <label className="trade-symbol">
            {mode === "search" ? "Search" : "Symbol"}
            {mode === "search" ? (
              <span className="trade-search">
                <input
                  value={symbol}
                  onChange={(event) => onSymbolChange(event.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder="Apple"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="trade-search-button"
                  disabled={busy !== null}
                  aria-busy={busy === "search"}
                  onClick={() => void runSearch()}
                >
                  {busy === "search" ? "Searching" : "Search"}
                </button>
              </span>
            ) : (
              <input
                value={symbol}
                onChange={(event) => onSymbolChange(event.target.value)}
                placeholder="AAPL"
                autoComplete="off"
              />
            )}
          </label>
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
          <Segmented
            label="Buy or sell"
            value="buy"
            disabled={busy !== null}
            choices={[
              { id: "buy", label: busy === "buy" ? "Buying" : "Buy", type: "submit", busy: busy === "buy" },
              {
                id: "sell",
                label: busy === "sell" ? "Selling" : "Sell",
                busy: busy === "sell",
                onClick: () => void submit("sell"),
              },
            ]}
          />
        </div>
        {mode === "search" && hits.length > 0 ? (
          <div className="data-table">
            <table>
              <caption>Search results</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Listing</th>
                  <th scope="col">Close</th>
                </tr>
              </thead>
              <tbody>
                {hits.map((hit) => {
                  const key = listingKey(hit);
                  return (
                    <tr key={key} aria-selected={selectedKey === key} onClick={() => choose(hit)}>
                      <th scope="row">
                        <button type="button" onClick={() => choose(hit)}>
                          {hit.name}
                        </button>
                      </th>
                      <td>{displaySymbol(hit)}</td>
                      <td>{hit.previousClose == null ? "—" : formatTrading(hit.previousClose, hit.tradingCurrency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {mode === "search" && searchNote ? <p className="trade-note">{searchNote}</p> : null}
      </div>
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

type SegmentChoice = {
  id: string;
  label: string;
  type?: "button" | "submit";
  busy?: boolean;
  onClick?: () => void;
};

function Segmented({
  label,
  value,
  choices,
  onChange,
  disabled,
  tabs = false,
}: {
  label: string;
  value: string;
  choices: SegmentChoice[];
  onChange?: (id: string) => void;
  disabled?: boolean;
  tabs?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const choicesRef = useRef(choices);
  const [pill, setPill] = useState({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);
  const signature = choices.map((choice) => `${choice.id}:${choice.label}`).join("|");
  choicesRef.current = choices;

  useLayoutEffect(() => {
    const list = listRef.current;
    const selected = choicesRef.current.findIndex((choice) => choice.id === value);
    const button = buttons.current[selected];
    if (!list || !button) return;

    const measure = () => setPill({ left: button.offsetLeft, width: button.offsetWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    observer.observe(button);
    const frame = requestAnimationFrame(() => setReady(true));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [signature, value]);

  return (
    <div
      ref={listRef}
      className="trade-segment"
      role={tabs ? "tablist" : "group"}
      aria-label={label}
      data-ready={ready ? "true" : "false"}
    >
      <span className="trade-segment-pill" style={{ left: pill.left, width: pill.width }} aria-hidden="true" />
      {choices.map((choice, index) => (
        <button
          key={choice.id}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          type={choice.type ?? "button"}
          role={tabs ? "tab" : undefined}
          id={tabs ? `trade-tab-${choice.id}` : undefined}
          aria-selected={tabs ? value === choice.id : undefined}
          aria-controls={tabs ? "trade-panel" : undefined}
          aria-busy={choice.busy || undefined}
          data-selected={value === choice.id ? "true" : "false"}
          tabIndex={tabs ? (value === choice.id ? 0 : -1) : undefined}
          disabled={disabled}
          onClick={() => {
            onChange?.(choice.id);
            choice.onClick?.();
          }}
          onKeyDown={
            tabs
              ? (event) => {
                  const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                  if (!direction) return;
                  event.preventDefault();
                  const next = (index + direction + choices.length) % choices.length;
                  onChange?.(choices[next].id);
                  buttons.current[next]?.focus();
                }
              : undefined
          }
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

function orderTotal(priceText: string, sharesText: string) {
  const price = Number(priceText);
  const count = Number(sharesText);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(count) || count <= 0) return null;
  return price * count;
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
