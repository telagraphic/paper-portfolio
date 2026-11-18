import { useEffect, useState, type FormEvent } from "react";
import { formatUsd } from "./format";
import type { PageBook } from "./page-book";
import { adminTabs, Tabs, type AdminTab } from "./PageTabs";

type FeedKey = {
  id: string;
  hint: string;
  active: boolean;
};

type FeedUsage = {
  day: string;
  limit: number;
  used: number;
  left: number;
  keys: FeedKey[];
};

type AdminPanelProps = {
  book: PageBook;
  onBook: (book: PageBook) => void;
  initialTab?: AdminTab;
};

const RULES = [
  ["Starting cash", "The book opens with this many dollars. Set it before the first buy or sell. After a trade is recorded, starting cash is fixed."],
  ["Added cash", "After trading has started, dollars added here join the cash bucket and can be spent on the next buy. This does not rewrite starting cash."],
  ["Buys", "A buy spends cash and is refused when cash would go below zero. Shares are whole numbers."],
  ["Fill", "The price locked in is the latest close already stored, or a typed mark when no close exists."],
  ["Symbols", "A US listing is shown without .US. Any other exchange keeps its suffix once. The feed still stores the symbol and the exchange together."],
  ["Closes", "A close is requested after that exchange's session ends. US cash ends at 4:00pm New York. One request covers every session since the last stored close."],
  ["Feed", "The free plan allows 20 requests each UTC day. The newest saved key is used. Without a saved key, nothing is requested."],
] as const;

const openingPlaceholder = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function AdminPanel({ book, onBook, initialTab = "cash" }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [usage, setUsage] = useState<FeedUsage | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [starting, setStarting] = useState("");
  const [added, setAdded] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin", { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("The feed status could not be loaded.");
        return response.json() as Promise<FeedUsage>;
      })
      .then(setUsage)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setNotice("The feed status could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  function changeTab(next: AdminTab) {
    setTab(next);
    setNotice("");
  }

  async function saveOpening(event: FormEvent) {
    event.preventDefault();
    const amount = readMoney(starting);
    if (amount == null || amount < 0) {
      setNotice("Enter a starting amount of zero or more.");
      return;
    }
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/admin/opening", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const body = (await response.json()) as PageBook & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setNotice(
        body.error === "has-trades"
          ? "Starting cash is fixed after the first trade. Add cash instead."
          : "The starting amount could not be saved.",
      );
      return;
    }
    onBook(body);
    setStarting("");
    setNotice("Saved. Equity now opens from this cash.");
  }

  async function saveCash(event: FormEvent) {
    event.preventDefault();
    const amount = readMoney(added);
    if (amount == null || amount <= 0) {
      setNotice("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/admin/cash", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const body = (await response.json()) as PageBook & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setNotice("The cash could not be added.");
      return;
    }
    onBook(body);
    setAdded("");
    setNotice("Added. This cash can be used to buy shares.");
  }

  async function saveKey(event: FormEvent) {
    event.preventDefault();
    if (!apiKey.trim()) return;
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/admin", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    setBusy(false);
    if (!response.ok) {
      setNotice("The key could not be saved.");
      return;
    }
    setUsage((await response.json()) as FeedUsage);
    onBook({ ...book, feedKeySaved: true });
    setApiKey("");
    setNotice("Saved. The next request uses this key.");
  }

  async function removeKey(id: string) {
    setBusy(true);
    setNotice("");
    const response = await fetch(`/api/admin/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      setNotice("The key could not be removed.");
      return;
    }
    const next = (await response.json()) as FeedUsage;
    setUsage(next);
    onBook({ ...book, feedKeySaved: next.keys.length > 0 });
    setNotice(next.keys.length === 0 ? "Removed. Search and trades need a key again." : "Removed.");
  }

  const keys = usage?.keys ?? [];
  const hasTrades = book.activity.length > 0;

  return (
    <section className="admin-panel" aria-label="Admin">
      <Tabs tabs={adminTabs} value={tab} onChange={changeTab} label="Admin" idPrefix="admin" tone="subtle" />
      <div key={tab} className="admin-panel-body" id={`admin-panel-${tab}`} role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
        {tab === "cash" ? (
          <>
            <p className="admin-note">
              Starting cash is {formatUsd(book.openingCashUsd)}. Cash is {formatUsd(book.cashUsd)}. Equity is {formatUsd(book.equityUsd)}.
            </p>
            {!hasTrades ? (
              <form className="admin-key" onSubmit={(event) => void saveOpening(event)}>
                <label htmlFor="opening-cash">Starting cash</label>
                <input
                  id="opening-cash"
                  type="text"
                  name="opening-cash"
                  inputMode="decimal"
                  autoComplete="off"
                  value={starting}
                  placeholder={openingPlaceholder.format(book.openingCashUsd)}
                  onChange={(event) => setStarting(event.target.value)}
                />
                <button type="submit" disabled={busy || !starting.trim()}>
                  {busy ? "Saving" : "Save starting cash"}
                </button>
              </form>
            ) : (
              <form className="admin-key" onSubmit={(event) => void saveCash(event)}>
                <label htmlFor="add-cash">Add cash</label>
                <input
                  id="add-cash"
                  type="text"
                  name="add-cash"
                  inputMode="decimal"
                  autoComplete="off"
                  value={added}
                  placeholder="0.00"
                  onChange={(event) => setAdded(event.target.value)}
                />
                <button type="submit" disabled={busy || !added.trim()}>
                  {busy ? "Saving" : "Add cash"}
                </button>
              </form>
            )}
            {hasTrades ? (
              <p className="admin-note">Starting cash is fixed after the first trade. Add cash to fund more buys without rewriting the opening amount.</p>
            ) : (
              <p className="admin-note">Set starting cash before the first buy or sell. After trading starts, use Add cash instead.</p>
            )}
          </>
        ) : null}
        {tab === "key" ? (
          <>
            {keys.length === 0 ? (
              <p className="admin-note">
                Search, closes, and trades need an EODHD API key.{" "}
                <a href="https://eodhd.com/" target="_blank" rel="noreferrer">
                  Sign up at EODHD
                </a>
                , copy the API key from your account, and save it below. The free plan is enough.
              </p>
            ) : null}
            <div className="data-table">
              <table>
                <caption>Feed requests</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Free requests</th>
                    <th scope="col">Used</th>
                    <th scope="col">Left</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{usage?.day ?? "—"}</th>
                    <td>{usage?.limit ?? "—"}</td>
                    <td>{usage?.used ?? "—"}</td>
                    <td>{usage?.left ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="admin-note">
              The free plan allows {usage?.limit ?? 20} requests each UTC day. This counts the requests this book has sent.
            </p>
            <form className="admin-key" onSubmit={(event) => void saveKey(event)}>
              <label htmlFor="eodhd-key">EODHD API key</label>
              <input
                id="eodhd-key"
                type="password"
                name="eodhd-api-key"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                placeholder="Add a key"
                onChange={(event) => setApiKey(event.target.value)}
              />
              <button type="submit" disabled={busy || !apiKey.trim()}>
                {busy ? "Saving" : "Save key"}
              </button>
            </form>
            <div className="data-table admin-keys">
              <table>
                <caption>Saved keys</caption>
                <thead>
                  <tr>
                    <th scope="col">Key</th>
                    <th scope="col">Use</th>
                    <th scope="col">
                      <span className="visually-hidden">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {keys.length === 0 ? (
                    <tr>
                      <td className="admin-empty" colSpan={3}>
                        No key is saved. Search and trades stay off until one is.
                      </td>
                    </tr>
                  ) : (
                    keys.map((key) => (
                      <tr key={key.id}>
                        <th scope="row">••••{key.hint}</th>
                        <td>{key.active ? "In use" : ""}</td>
                        <td>
                          <button type="button" disabled={busy} onClick={() => void removeKey(key.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="admin-note">
              The newest saved key is sent on the next quote, search, or history request. Remove it to use the next saved key.
            </p>
          </>
        ) : null}
        {tab === "rules" ? (
          <div className="data-table admin-rules-table">
            <table>
              <caption>Rules</caption>
              <thead>
                <tr>
                  <th scope="col">Rule</th>
                  <th scope="col">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {RULES.map(([term, meaning]) => (
                  <tr key={term}>
                    <th scope="row">{term}</th>
                    <td>{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {notice ? <p className="admin-note">{notice}</p> : null}
      </div>
    </section>
  );
}

function readMoney(value: string) {
  const amount = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(amount) ? amount : null;
}
