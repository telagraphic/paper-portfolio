import type { ActivityView } from "../book/book";
import { formatSessionDate, formatShares, formatTrading, listingKey } from "./format";
import { displayName, displaySymbol, type PageListing } from "./page-book";

type ActivityListProps = {
  listings: PageListing[];
  activity: ActivityView[];
};

export function ActivityList({ listings, activity }: ActivityListProps) {
  const names = new Map(listings.map((listing) => [listingKey(listing), listing.name]));
  const rows = [...activity].reverse();

  return (
    <div className="activity-list data-table">
      <table>
        <caption>Buys and sells</caption>
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col">Name</th>
            <th scope="col">Date</th>
            <th scope="col">Buy/Sell</th>
            <th scope="col">Shares</th>
            <th scope="col">Price</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="listing-empty" colSpan={7}>
                No trades.
              </td>
            </tr>
          ) : (
            rows.map((trade) => {
              const key = listingKey(trade);
              return (
                <tr key={trade.id}>
                  <th scope="row">{displaySymbol(trade)}</th>
                  <td className="listing-name">{displayName({ symbol: trade.symbol, name: names.get(key) ?? null })}</td>
                  <td>{formatSessionDate(trade.recordedAt)}</td>
                  <td>
                    <span className={trade.side === "buy" ? "side-pill up" : "side-pill down"}>
                      {trade.side === "buy" ? "Buy" : "Sell"}
                    </span>
                  </td>
                  <td>{formatShares(trade.shares)}</td>
                  <td>{formatTrading(trade.fill, trade.tradingCurrency)}</td>
                  <td>{formatTrading(trade.shares * trade.fill, trade.tradingCurrency)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
