import { useEffect, useState } from "react";
import type { ActivityView, BookView } from "../book/book";
import { ActivityList } from "./ActivityList";
import { BookFigures } from "./BookFigures";
import { EquityChart } from "./EquityChart";
import { listingKey } from "./format";
import { ListingDetail } from "./ListingDetail";
import { ListingList } from "./ListingList";
import { TradeForm } from "./TradeForm";

const deleteErrors: Record<string, string> = {
  "needed-for-sell": "Delete the sell first. This buy still has shares in a later sell.",
  depends: "A later trade depends on this one.",
  missing: "That trade is no longer in the book.",
};

export function App() {
  const [book, setBook] = useState<BookView | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<ActivityView | null>(null);
  const [deleteNotice, setDeleteNotice] = useState("");

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
      <BookFigures book={book} />
      <TradeForm
        cashUsd={book.cashUsd}
        onBook={(next, key) => {
          setBook(next);
          setSelected(key);
          setPending(null);
          setDeleteNotice("");
        }}
      />
      <EquityChart series={book.equitySeries} />
      <div className="book-split">
        <ListingList listings={book.listings} selected={selected} onSelect={setSelected} />
        <ListingDetail listing={listing} />
      </div>
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
    </main>
  );
}
