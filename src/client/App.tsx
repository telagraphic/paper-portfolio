import { useEffect, useRef, useState } from "react";
import type { ActivityView, BookView } from "../book/book";
import { ActivityList } from "./ActivityList";
import { BookFigures } from "./BookFigures";
import { EquityChart } from "./EquityChart";
import { listingKey } from "./format";
import { ListingDetail } from "./ListingDetail";
import { ListingList } from "./ListingList";
import { PageTabs, type PageTab } from "./PageTabs";
import { TradeForm } from "./TradeForm";

const deleteErrors: Record<string, string> = {
  "needed-for-sell": "Delete the sell first. This buy still has shares in a later sell.",
  depends: "A later trade depends on this one.",
  missing: "That trade is no longer in the book.",
};

export function App() {
  const [book, setBook] = useState<BookView | null>(null);
  const [tab, setTab] = useState<PageTab>("totals");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<ActivityView | null>(null);
  const [deleteNotice, setDeleteNotice] = useState("");
  const knownListings = useRef<Set<string> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/book", { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("The book could not be loaded.");
        return response.json() as Promise<BookView>;
      })
      .then(setBook)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("The book could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  const listingKeys = book?.listings.map((item) => listingKey(item)) ?? [];
  const listingKeyList = listingKeys.join("\n");
  const entering =
    knownListings.current === null ? [] : listingKeys.filter((key) => !knownListings.current?.has(key));

  useEffect(() => {
    if (!book || tab === "trade") return;
    knownListings.current = new Set(listingKeyList.length === 0 ? [] : listingKeyList.split("\n"));
  }, [book, tab, listingKeyList]);

  async function confirmDelete() {
    if (!pending) return;
    const response = await fetch(`/api/trades/${encodeURIComponent(pending.id)}`, { method: "DELETE" });
    const body = (await response.json()) as BookView & { error?: string };
    if (!response.ok) {
      setDeleteNotice(deleteErrors[body.error ?? ""] ?? "The trade could not be deleted.");
      return;
    }
    setBook(body);
    setPending(null);
    setDeleteNotice("");
  }

  if (error) return <p className="book-status">{error}</p>;
  if (!book) return <p className="book-status">Loading the book.</p>;

  const listing = book.listings.find((item) => listingKey(item) === selected) ?? null;

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="page-title">Paper Portfolio</h1>
        <PageTabs value={tab} onChange={setTab} />
      </header>
      <div key={tab} className="tab-panel" id={`page-panel-${tab}`} role="tabpanel" aria-labelledby={`page-tab-${tab}`}>
        {tab === "totals" ? (
          <>
            <BookFigures book={book} />
            <EquityChart series={book.equitySeries} />
            <ListingList listings={book.listings} selected={selected} onSelect={setSelected} entering={entering} />
            <ActivityList
              activity={book.activity}
              pending={pending}
              notice={deleteNotice}
              onAsk={(trade) => {
                setPending(trade);
                setDeleteNotice("");
              }}
              onConfirm={() => void confirmDelete()}
              onKeep={() => {
                setPending(null);
                setDeleteNotice("");
              }}
            />
          </>
        ) : null}
        {tab === "tickers" ? (
          <>
            <ListingDetail listing={listing} />
            <ListingList listings={book.listings} selected={selected} onSelect={setSelected} entering={entering} />
            <ActivityList
              activity={book.activity}
              pending={pending}
              notice={deleteNotice}
              onAsk={(trade) => {
                setPending(trade);
                setDeleteNotice("");
              }}
              onConfirm={() => void confirmDelete()}
              onKeep={() => {
                setPending(null);
                setDeleteNotice("");
              }}
            />
          </>
        ) : null}
        {tab === "trade" ? (
          <TradeForm
            cashUsd={book.cashUsd}
            onBook={(next, key) => {
              setBook(next);
              setSelected(key);
              setPending(null);
              setDeleteNotice("");
            }}
          />
        ) : null}
      </div>
    </main>
  );
}
