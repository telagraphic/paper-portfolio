import type { BookView } from "../book/book";
import { formatSignedUsd, formatUsd, gainTone } from "./format";
import { MorphValue } from "./MorphValue";

export function BookFigures({ book }: { book: BookView }) {
  const figures = [
    { label: "Day", value: book.dayGainUsd },
    { label: "Total", value: book.totalGainUsd },
    { label: "Realized", value: book.realizedGainUsd },
  ] as const;

  return (
    <section className="book-figures" aria-label="Paper portfolio">
      <dl>
        <div className="book-equity">
          <dt>Equity</dt>
          <dd>
            <MorphValue>{formatUsd(book.equityUsd)}</MorphValue>
          </dd>
        </div>
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt>{figure.label}</dt>
            <dd className={gainTone(figure.value)}>
              <MorphValue>{formatSignedUsd(figure.value)}</MorphValue>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
