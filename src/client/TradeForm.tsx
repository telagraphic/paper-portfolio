import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { TradeSide } from "../book/book";
import { displaySymbol, distinctName, type PageBook, type PageListing } from "./page-book";
import type { SearchHit } from "../quotes/eodhd";
import { formatTrading, formatUsd, listingKey } from "./format";
import { MorphValue } from "./MorphValue";
import { TradeButton, type TradePhase } from "./TradeButton";

const errors: Record<string, string> = {
  invalid: "Enter a symbol, an exchange, and a share price.",
  "whole-shares": "Enter a whole number of shares.",
  mark: "Enter a share price above zero.",
  "fx-required": "A non-USD listing needs an FX close before it can change cash.",
  "insufficient-cash": "Not enough cash for this buy.",
  "insufficient-shares": "Not enough shares for this sell.",
  "no-close": "No close is stored for that listing. Enter a share price.",
};

type TradeMode = "search" | "manual";

// Height glides on a long ease-out; fades use a softer ease-in-out so they never snap.
const GLIDE = [0.32, 0.72, 0, 1] as const;
const SOFT = [0.4, 0, 0.2, 1] as const;
// Matches the .trade-fields gap, so a collapsed field takes its gap with it.
const FIELD_GAP = 12;
// How long the button holds "Bought 10 AAPL" before it settles back to the next order.
const DONE_HOLD_MS = 1800;
// How long the filled-in values fade out before a finished order clears the form.
const CLEAR_FADE_MS = 280;

type TradeFormProps = {
  cashUsd: number;
  listings: PageListing[];
  feedKeySaved: boolean;
  onBook: (book: PageBook, selected: string) => void;
  onAddKey: () => void;
};

export function TradeForm({ cashUsd, listings, feedKeySaved, onBook, onAddKey }: TradeFormProps) {
  const [mode, setMode] = useState<TradeMode>("search");
  const [side, setSide] = useState<TradeSide>("buy");
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
  const [done, setDone] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => {
      setDone(null);
      setMessage("");
    }, DONE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [done]);

  const holdings = listings.filter((listing) => listing.shares > 0);
  // A manual buy is always priced in dollars; search and sell carry the listing's currency.
  const currency = side === "buy" && mode === "manual" ? "USD" : tradingCurrency;
  const total = orderTotal(sharePrice, shares);
  const searching = side === "buy" && mode === "search";
  const reduceMotion = useReducedMotion();
  const swap: Transition = reduceMotion ? { duration: 0 } : { duration: 0.36, ease: SOFT };
  const fadeOut: Transition = reduceMotion ? { duration: 0 } : { duration: 0.26, ease: SOFT };
  // Opening makes room first and fades in after; closing fades out first and then gives the room back.
  const open: Transition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.48, ease: GLIDE },
        marginTop: { duration: 0.48, ease: GLIDE },
        opacity: { duration: 0.38, delay: 0.12, ease: SOFT },
        filter: { duration: 0.38, delay: 0.12, ease: SOFT },
      };
  const close: Transition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.42, delay: 0.1, ease: GLIDE },
        marginTop: { duration: 0.42, delay: 0.1, ease: GLIDE },
        opacity: { duration: 0.26, ease: SOFT },
        filter: { duration: 0.26, ease: SOFT },
      };

  // A finished order fades its values out (data-clearing), then empties every field.
  useEffect(() => {
    if (!clearing) return;
    const timer = setTimeout(
      () => {
        clearFields();
        setShares("");
        setClearing(false);
      },
      reduceMotion ? 0 : CLEAR_FADE_MS,
    );
    return () => clearTimeout(timer);
  }, [clearing, reduceMotion]);

  function clearListing() {
    setDone(null);
    setClearing(false);
    clearFields();
  }

  function clearFields() {
    setSymbol("");
    setExchange("");
    setTradingCurrency("USD");
    setSharePrice("");
    setSelectedKey("");
    setHits([]);
    setSearchNote("");
    setError("");
  }

  function changeSide(next: TradeSide) {
    if (next === side) return;
    setSide(next);
    setMessage("");
    clearListing();
  }

  function changeMode(next: TradeMode) {
    if (next === mode) return;
    setMode(next);
    setMessage("");
    clearListing();
  }

  async function submit() {
    if (!feedKeySaved) return;
    setError("");
    setMessage("");
    const fields = readFields({ symbol, shares, exchange, tradingCurrency: currency, sharePrice });
    if ("error" in fields) {
      setError(errors[fields.error] ?? errors.invalid);
      return;
    }

    const chosen = hits.find((hit) => listingKey(hit) === selectedKey);
    const name =
      searching && chosen && chosen.symbol === fields.symbol && chosen.exchange === fields.exchange
        ? chosen.name
        : undefined;
    setDone(null);
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
      setDone(`${side === "buy" ? "Bought" : "Sold"} ${fields.shares.toLocaleString("en-US")} ${displaySymbol(fields)}`);
      setMessage(
        side === "buy"
          ? `Bought ${fields.shares.toLocaleString("en-US")} shares of ${displaySymbol(fields)}.`
          : `Sold ${fields.shares.toLocaleString("en-US")} shares of ${displaySymbol(fields)}.`,
      );
      onBook(body, listingKey(fields));
      setClearing(true);
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
    if (!query || !feedKeySaved) return;
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

  function chooseHolding(key: string) {
    const holding = holdings.find((listing) => listingKey(listing) === key);
    setSelectedKey(key);
    setError("");
    if (!holding) {
      clearListing();
      return;
    }
    setSymbol(holding.symbol);
    setExchange(holding.exchange);
    setTradingCurrency(holding.tradingCurrency);
    setSharePrice(String(holding.mark));
  }

  function onSymbolChange(value: string) {
    setSymbol(value);
    if (!searching) return;
    setSelectedKey("");
    setSharePrice("");
    setTradingCurrency("USD");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  const phase: TradePhase = busy === side ? "busy" : done ? "done" : "idle";
  const submitLabel = phase === "done" && done ? done : tradeLabel(side, phase === "busy", orderSummary());

  // The label names the order as it is filled in: "Buy", then "Buy 10", then "Buy 10 AAPL".
  function orderSummary() {
    const count = Number(shares);
    const picked = side === "sell" || searching ? Boolean(selectedKey) : Boolean(symbol.trim());
    return [
      Number.isInteger(count) && count > 0 ? count.toLocaleString("en-US") : "",
      picked ? displaySymbol({ symbol: symbol.trim(), exchange: exchange.trim() || "US" }) : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const priceLabel = selectedKey && currency !== "USD" ? `Share price, ${currency}` : "Share price";

  return (
    <form
      className="trade-form"
      onSubmit={onSubmit}
      aria-busy={busy !== null}
      data-key={feedKeySaved ? undefined : "missing"}
      data-clearing={clearing ? "true" : undefined}
    >
      <div className="trade-main">
        <div className="trade-modes">
          <Segmented
            label="Trade entry"
            value={mode}
            tabs
            disabled={side === "sell"}
            choices={[
              { id: "search", label: "Search", hint: "Automatic ticker lookup" },
              { id: "manual", label: "Manual", hint: "Add the ticker manually" },
            ]}
            onChange={(id) => changeMode(id as TradeMode)}
          />
          <Segmented
            label="Buy or sell"
            value={side}
            tone="side"
            choices={[
              { id: "buy", label: "Buy" },
              { id: "sell", label: "Sell" },
            ]}
            onChange={(id) => changeSide(id as TradeSide)}
          />
        </div>
        <div
          className="trade-fields"
          role="tabpanel"
          id="trade-panel"
          aria-labelledby={mode === "search" ? "trade-tab-search" : "trade-tab-manual"}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={side === "sell" ? "listing" : mode}
              className="trade-field"
              initial={{ opacity: 0, filter: "blur(2px)" }}
              animate={{ opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
              exit={{ opacity: 0, filter: "blur(2px)" }}
              transition={swap}
            >
              {side === "sell" ? (
                <label>
                  Listing
                  <select
                    value={selectedKey}
                    disabled={holdings.length === 0}
                    onChange={(event) => chooseHolding(event.target.value)}
                  >
                    <option value="">{holdings.length === 0 ? "No shares to sell" : "Choose a listing"}</option>
                    {holdings.map((listing) => {
                      const name = distinctName(listing);
                      return (
                        <option key={listingKey(listing)} value={listingKey(listing)}>
                          {displaySymbol(listing)}
                          {name ? ` · ${name}` : ""} · {listing.shares.toLocaleString("en-US")} shares
                        </option>
                      );
                    })}
                  </select>
                </label>
              ) : searching ? (
                <label>
                  Search
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
                      disabled={busy !== null || !feedKeySaved}
                      aria-busy={busy === "search"}
                      onClick={() => void runSearch()}
                    >
                      {busy === "search" ? "Searching" : "Search"}
                    </button>
                  </span>
                </label>
              ) : (
                <label>
                  <span className="trade-label-row">
                    Symbol
                    <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
                      Look up on TradingView
                    </a>
                  </span>
                  <input
                    value={symbol}
                    onChange={(event) => onSymbolChange(event.target.value)}
                    placeholder="AAPL"
                    autoComplete="off"
                  />
                </label>
              )}
            </motion.div>
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {side === "buy" ? (
              <motion.div
                key="exchange"
                className="trade-field"
                initial={{ height: 0, opacity: 0, filter: "blur(3px)", marginTop: -FIELD_GAP, overflow: "hidden" }}
                animate={{
                  height: "auto",
                  opacity: 1,
                  filter: "blur(0px)",
                  marginTop: 0,
                  transition: open,
                  transitionEnd: { overflow: "visible", filter: "none" },
                }}
                exit={{
                  height: 0,
                  opacity: 0,
                  filter: "blur(3px)",
                  marginTop: -FIELD_GAP,
                  overflow: "hidden",
                  transition: close,
                }}
              >
                <label>
                  Exchange
                  <input
                    value={exchange}
                    onChange={(event) => setExchange(event.target.value)}
                    placeholder="US"
                    autoComplete="off"
                  />
                </label>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <label>
            {priceLabel}
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
        </div>
        <TradeButton phase={phase} label={submitLabel} disabled={busy !== null || !feedKeySaved} />
        {!feedKeySaved ? (
          <p className="trade-note trade-key-note" role="status">
            No key provided. Search and trades need an EODHD API key.{" "}
            <button type="button" onClick={onAddKey}>
              Add a key in Admin
            </button>
          </p>
        ) : null}
        {error ? (
          <p className="trade-error" role="alert">
            {error}
          </p>
        ) : null}
        <AnimatePresence initial={false}>
          {message ? (
            <motion.p key="status" className="trade-status" role="status" exit={{ opacity: 0 }} transition={fadeOut}>
              {message}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="trade-side">
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
                {total == null ? "—" : formatTrading(total, currency)}
              </dd>
            </div>
          </dl>
        </section>
        {/* One slot on the right: results, or a note about them. Results fade out when the form clears. */}
        <AnimatePresence mode="wait" initial={false}>
          {searching && hits.length > 0 ? (
            <motion.div key="results" className="data-table" exit={{ opacity: 0 }} transition={fadeOut}>
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
            </motion.div>
          ) : searching ? (
            <motion.p key="note" className="trade-note" exit={{ opacity: 0 }} transition={fadeOut}>
              {searchNote || "Search for a company or symbol. Matching listings appear here."}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </form>
  );
}

type SegmentChoice = {
  id: string;
  label: string;
  hint?: string;
};

function Segmented({
  label,
  value,
  choices,
  onChange,
  disabled,
  tabs = false,
  tone,
}: {
  label: string;
  value: string;
  choices: SegmentChoice[];
  onChange?: (id: string) => void;
  disabled?: boolean;
  tabs?: boolean;
  /** "side" tints the pill green for buy and red for sell. */
  tone?: "side";
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
      data-tone={tone}
      data-value={value}
    >
      <span className="trade-segment-pill" style={{ left: pill.left, width: pill.width }} aria-hidden="true" />
      {choices.map((choice, index) => (
        <button
          key={choice.id}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          type="button"
          role={tabs ? "tab" : undefined}
          id={tabs ? `trade-tab-${choice.id}` : undefined}
          aria-selected={tabs ? value === choice.id : undefined}
          aria-controls={tabs ? "trade-panel" : undefined}
          aria-pressed={tabs ? undefined : value === choice.id}
          aria-describedby={choice.hint ? `trade-hint-${choice.id}` : undefined}
          data-selected={value === choice.id ? "true" : "false"}
          tabIndex={tabs ? (value === choice.id ? 0 : -1) : undefined}
          disabled={disabled}
          onClick={() => onChange?.(choice.id)}
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
          {choice.hint ? (
            <span className="trade-tooltip" id={`trade-hint-${choice.id}`} role="tooltip">
              {choice.hint}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function tradeLabel(side: TradeSide, busy: boolean, order: string) {
  const verb = side === "buy" ? (busy ? "Buying" : "Buy") : busy ? "Selling" : "Sell";
  return order ? `${verb} ${order}` : verb;
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
