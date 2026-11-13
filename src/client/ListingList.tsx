import { useRef } from "react";
import type { ListingView } from "../book/book";
import { formatShares, formatTrading, formatUsd, formatUsdOrBlank, gainTone, listingKey } from "./format";

type ListingListProps = {
  listings: ListingView[];
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
            <th scope="col">Listing</th>
            <th scope="col">Shares</th>
            <th scope="col">Mark</th>
            <th scope="col">Day gain</th>
            <th scope="col">Total gain</th>
            <th scope="col">Realized</th>
          </tr>
        </thead>
        <tbody>
          {listings.length === 0 ? (
            <tr>
              <td className="listing-empty" colSpan={6}>
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
                  <td>{formatShares(listing.shares)}</td>
                  <td>{formatTrading(listing.mark, listing.tradingCurrency)}</td>
                  <td className={gainTone(listing.dayGainUsd)}>{formatUsdOrBlank(listing.dayGainUsd)}</td>
                  <td className={gainTone(listing.totalGainUsd)}>{formatUsdOrBlank(listing.totalGainUsd)}</td>
                  <td className={gainTone(listing.realizedGainUsd)}>{formatUsd(listing.realizedGainUsd)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
