import { useEffect, useRef, useState } from "react";
import { FlowValue, rateFormat, sharesFormat, tradingPresentation, usdFormat } from "./FlowValue";
import { gainTone, listingKey } from "./format";
import { displaySymbol, distinctName, type PageListing } from "./page-book";

type ListingListProps = {
  listings: PageListing[];
  selected: string;
  onSelect: (key: string) => void;
  entering?: string[];
  copySymbol?: boolean;
};

export function ListingList({ listings, selected, onSelect, entering = [], copySymbol = false }: ListingListProps) {
  const enteringKeys = useRef<Set<string> | null>(null);
  const copyTimer = useRef<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  if (enteringKeys.current === null) enteringKeys.current = new Set(entering);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  async function copyListing(key: string) {
    try {
      await navigator.clipboard.writeText(key);
    } catch {
      return;
    }
    setCopied(key);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => {
      setCopied(null);
      copyTimer.current = null;
    }, 1200);
  }

  return (
    <div className="listing-list data-table">
      <table>
        <caption>Listings</caption>
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col">Name</th>
            <th scope="col">Day</th>
            <th scope="col">Shares</th>
            <th scope="col">Price</th>
            <th scope="col">Value</th>
            <th scope="col">Weight</th>
            <th scope="col">Total</th>
            <th scope="col">Realized</th>
          </tr>
        </thead>
        <tbody>
          {listings.length === 0 ? (
            <tr>
              <td className="listing-empty" colSpan={9}>
                No listings.
              </td>
            </tr>
          ) : (
            listings.map((listing) => {
              const key = listingKey(listing);
              return (
                <tr
                  key={key}
                  className={enteringKeys.current?.has(key) ? "listing-enter" : undefined}
                  aria-selected={key === selected}
                  onClick={() => onSelect(key)}
                >
                  <th scope="row">
                    <button
                      type="button"
                      data-copied={copied === key ? "true" : undefined}
                      aria-label={copySymbol ? (copied === key ? `Copied ${key}` : `Copy ${key}`) : undefined}
                      onClick={(event) => {
                        if (!copySymbol) {
                          onSelect(key);
                          return;
                        }
                        event.stopPropagation();
                        void copyListing(key);
                      }}
                    >
                      {copySymbol && copied === key ? "Copied" : displaySymbol(listing)}
                    </button>
                  </th>
                  <td className="listing-name">
                    <span className="listing-name-scroll">{distinctName(listing) ?? "—"}</span>
                  </td>
                  <td>
                    <span className={pillClass(listing.dayReturn)}>
                      <FlowValue value={listing.dayReturn} format={rateFormat} signed intro />
                    </span>
                  </td>
                  <td>
                    <FlowValue value={listing.shares} format={sharesFormat} intro />
                  </td>
                  <td>
                    <FlowValue value={listing.mark} {...tradingPresentation(listing.tradingCurrency)} intro />
                  </td>
                  <td>
                    <FlowValue value={listing.marketValueUsd} format={usdFormat} intro />
                  </td>
                  <td>
                    <FlowValue value={listing.weight} format={rateFormat} intro />
                  </td>
                  <td className={gainTone(listing.totalGainUsd)}>
                    <FlowValue value={listing.totalGainUsd} format={usdFormat} signed intro />
                  </td>
                  <td className={gainTone(listing.realizedGainUsd)}>
                    <FlowValue value={listing.realizedGainUsd} format={usdFormat} signed intro />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function pillClass(value: number | null) {
  const tone = gainTone(value);
  return tone ? `day-pill ${tone}` : "day-pill";
}
