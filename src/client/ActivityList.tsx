import type { ActivityView } from "../book/book";
import { formatShares, formatTrading, formatWhen } from "./format";

type ActivityListProps = {
  activity: ActivityView[];
  pending: ActivityView | null;
  notice: string;
  onAsk: (trade: ActivityView) => void;
  onConfirm: () => void;
  onKeep: () => void;
};

export function ActivityList({ activity, pending, notice, onAsk, onConfirm, onKeep }: ActivityListProps) {
  return (
    <div className="activity-list">
      {pending ? (
        <section className="delete-confirm" aria-label="Confirm deletion">
          <p>
            Delete the {pending.side} of {formatShares(pending.shares)} {pending.symbol}.{pending.exchange}?
          </p>
          <div className="delete-actions">
            <button type="button" onClick={onConfirm}>
              Delete trade
            </button>
            <button type="button" onClick={onKeep}>
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
            <th scope="col">Date</th>
            <th scope="col">Side</th>
            <th scope="col">Listing</th>
            <th scope="col">Shares</th>
            <th scope="col">Fill</th>
            <th scope="col">
              <span className="activity-sr">Delete</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {activity.length === 0 ? (
            <tr>
              <td className="activity-empty" colSpan={6}>
                No trades.
              </td>
            </tr>
          ) : (
            activity.map((trade) => (
              <tr key={trade.id}>
                <td>{formatWhen(trade.recordedAt)}</td>
                <td>{trade.side === "buy" ? "Buy" : "Sell"}</td>
                <td>
                  {trade.symbol}.{trade.exchange}
                </td>
                <td>{formatShares(trade.shares)}</td>
                <td>{formatTrading(trade.fill, trade.tradingCurrency)}</td>
                <td>
                  <button type="button" onClick={() => onAsk(trade)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
