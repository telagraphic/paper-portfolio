import type { BookView } from "../book/book";
import { FlowValue, rateFormat, usdFormat } from "./FlowValue";
import { gainTone } from "./format";

export function BookFigures({ book }: { book: BookView }) {
  return (
    <section className="book-figures" aria-label="Paper portfolio">
      <dl>
        <div className="book-equity">
          <dt>Equity</dt>
          <dd>
            <FlowValue value={book.equityUsd} format={usdFormat} intro />
          </dd>
        </div>
        <div>
          <dt>Cash</dt>
          <dd>
            <FlowValue value={book.cashUsd} format={usdFormat} intro />
          </dd>
        </div>
        <div>
          <dt>Invested</dt>
          <dd>
            <FlowValue value={book.equityUsd - book.cashUsd} format={usdFormat} intro />
          </dd>
        </div>
        <div>
          <dt>Day</dt>
          <dd className={gainTone(book.dayGainUsd)}>
            <FlowValue value={book.dayGainUsd} format={usdFormat} signed intro />
            <span className="book-rate">
              <FlowValue value={figureRate(book.dayGainUsd, book.equityUsd)} format={rateFormat} signed intro />
            </span>
          </dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd className={gainTone(book.totalGainUsd)}>
            <FlowValue value={book.totalGainUsd} format={usdFormat} signed intro />
            <span className="book-rate">
              <FlowValue value={figureRate(book.totalGainUsd, book.equityUsd)} format={rateFormat} signed intro />
            </span>
          </dd>
        </div>
        <div>
          <dt>Realized</dt>
          <dd>
            <FlowValue value={book.realizedGainUsd} format={usdFormat} signed intro />
          </dd>
        </div>
      </dl>
    </section>
  );
}

function figureRate(gain: number | null, equity: number) {
  if (gain == null) return null;
  const base = equity - gain;
  if (base === 0) return null;
  return gain / base;
}
