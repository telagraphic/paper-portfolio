import { useEffect, useRef, useState } from "react";
import { ActivityList } from "./ActivityList";
import { AdminPanel } from "./AdminPanel";
import { BookFigures } from "./BookFigures";
import { EquityChart } from "./EquityChart";
import { listingKey } from "./format";
import { ListingDetail, ListingFigures } from "./ListingDetail";
import { ListingList } from "./ListingList";
import { formatCloseDate, latestCloseDate, type PageBook } from "./page-book";
import { PageTabs, type PageTab } from "./PageTabs";
import { TermList } from "./TermList";
import { TradeForm } from "./TradeForm";

export function App() {
  const [book, setBook] = useState<PageBook | null>(null);
  const [tab, setTab] = useState<PageTab>("totals");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const knownListings = useRef<Set<string> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/book", { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("The book could not be loaded.");
        return response.json() as Promise<PageBook>;
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
  const listVisible = tab === "totals" || tab === "tickers";
  const entering =
    knownListings.current === null || !listVisible
      ? []
      : listingKeys.filter((key) => !knownListings.current?.has(key));

  useEffect(() => {
    if (!book || !listVisible) return;
    knownListings.current = new Set(listingKeyList.length === 0 ? [] : listingKeyList.split("\n"));
  }, [book, listVisible, listingKeyList]);

  useEffect(() => {
    if (tab !== "tickers" || listingKeyList.length === 0) return;
    const keys = listingKeyList.split("\n");
    if (keys.includes(selected)) return;
    setSelected(keys[0]);
  }, [tab, listingKeyList, selected]);

  if (error) return <p className="book-status">{error}</p>;
  if (!book) return <p className="book-status">Loading the book.</p>;

  const listing = book.listings.find((item) => listingKey(item) === selected) ?? null;
  const updated = latestCloseDate(book.listings);

  return (
    <main className="page">
      <header className="page-head">
        <div className="page-title-row">
          <h1 className="page-title">Paper Portfolio</h1>
          {updated ? (
            <p className="page-updated">
              Last updated <time dateTime={updated}>{formatCloseDate(updated)}</time>
            </p>
          ) : null}
        </div>
        <PageTabs value={tab} onChange={setTab} />
      </header>
      <div key={tab} className="tab-panel" id={`page-panel-${tab}`} role="tabpanel" aria-labelledby={`page-tab-${tab}`}>
        {tab === "totals" ? (
          <>
            <BookFigures book={book} />
            <EquityChart series={book.equitySeries} />
            <ListingList listings={book.listings} selected={selected} onSelect={setSelected} entering={entering} />
          </>
        ) : null}
        {tab === "tickers" ? (
          <>
            <ListingDetail listing={listing} />
            <div className="listing-sheet">
              {listing ? <ListingFigures listing={listing} /> : null}
              <ListingList
                listings={book.listings}
                selected={selected}
                onSelect={setSelected}
                entering={entering}
                copySymbol
              />
              <TermList />
            </div>
          </>
        ) : null}
        {tab === "trade" ? (
          <TradeForm
            cashUsd={book.cashUsd}
            onBook={(next, key) => {
              setBook(next);
              setSelected(key);
            }}
          />
        ) : null}
        {tab === "history" ? (
          <ActivityList listings={book.listings} activity={book.activity} />
        ) : null}
        {tab === "admin" ? <AdminPanel book={book} onBook={setBook} /> : null}
      </div>
      <p className="page-credit">
        <a href="https://www.tradingview.com/">Charts by TradingView</a>
      </p>
    </main>
  );
}
