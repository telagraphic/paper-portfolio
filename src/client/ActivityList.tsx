import type { ActivityView } from "../book/book";
import { formatSessionDate, formatShares, formatTrading, listingKey } from "./format";
import { displayName, type PageListing } from "./page-book";

type ActivityListProps = {
  listings: PageListing[];
  activity: ActivityView[];
  pending: ActivityView | null;
  notice: string;
  onAsk: (trade: ActivityView) => void;
  onConfirm: () => void;
  onKeep: () => void;
};

export function ActivityList({ listings, activity, pending, notice, onAsk, onConfirm, onKeep }: ActivityListProps) {
  const names = new Map(listings.map((listing) => [listingKey(listing), listing.name]));
  const rows = [...activity].reverse();

  return (
    <div className="activity-list data-table">
      {pending ? (
        <section className="delete-confirm" aria-label="Confirm deletion">
          <p>
            Delete the {pending.side} of {formatShares(pending.shares)} {pending.symbol}.{pending.exchange}?
          </p>
          <div className="delete-actions">
            <button type="button" onClick={onConfirm}>
              Delete trade
            </button>
            <button type="button" className="delete-keep" onClick={onKeep}>
              Keep trade
            </button>
          </div>
        </section>
      ) : null}
      {notice ? <p className="delete-notice">{notice}</p> : null}
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
            <th scope="col">Delete</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="listing-empty" colSpan={8}>
                No trades.
              </td>
            </tr>
          ) : (
            rows.map((trade) => {
              const key = listingKey(trade);
              return (
                <tr key={trade.id}>
                  <th scope="row">{key}</th>
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
                  <td>
                    <button type="button" onClick={() => onAsk(trade)}>
                      Delete
                    </button>
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
