import type { BookView } from "../book/book";
import { formatOpened, formatUsdOrBlank, gainTone } from "./format";
import { MorphValue } from "./MorphValue";

export function BookFigures({ book }: { book: BookView }) {
  const figures = [
    { label: "Equity", value: book.equityUsd, signed: false },
    { label: "Day gain", value: book.dayGainUsd, signed: true },
    { label: "Total gain", value: book.totalGainUsd, signed: true },
    { label: "Realized gain", value: book.realizedGainUsd, signed: true },
  ] as const;

  return (
    <section className="book-figures" aria-label="Paper portfolio">
      <p className="book-opened">Opened {formatOpened(book.createdAt)}</p>
      <dl>
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt>{figure.label}</dt>
            <dd className={figure.label === "Equity" ? "book-equity" : figure.signed ? gainTone(figure.value) : undefined}>
              <MorphValue>{formatUsdOrBlank(figure.value)}</MorphValue>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
