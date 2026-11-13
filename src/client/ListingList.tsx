import { useRef } from "react";
import { formatRate, formatShares, formatSignedRate, formatSignedUsd, formatTrading, formatUsdOrBlank, gainTone, listingKey } from "./format";
import { displayName, type PageListing } from "./page-book";

type ListingListProps = {
  listings: PageListing[];
  selected: string;
  onSelect: (key: string) => void;
  entering?: string[];
};

export function ListingList({ listings, selected, onSelect, entering = [] }: ListingListProps) {
  const enteringKeys = useRef<Set<string> | null>(null);
  if (enteringKeys.current === null) enteringKeys.current = new Set(entering);

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
                    <button type="button" onClick={() => onSelect(key)}>
                      {key}
                    </button>
                  </th>
                  <td className="listing-name">
                    <span className="listing-name-scroll">{displayName(listing)}</span>
                  </td>
                  <td>
                    <span className={pillClass(listing.dayReturn)}>{formatSignedRate(listing.dayReturn)}</span>
                  </td>
                  <td>{formatShares(listing.shares)}</td>
                  <td>{formatTrading(listing.mark, listing.tradingCurrency)}</td>
                  <td>{formatUsdOrBlank(listing.marketValueUsd)}</td>
                  <td>{formatRate(listing.weight)}</td>
                  <td className={gainTone(listing.totalGainUsd)}>{formatSignedUsd(listing.totalGainUsd)}</td>
                  <td className={gainTone(listing.realizedGainUsd)}>{formatSignedUsd(listing.realizedGainUsd)}</td>
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
