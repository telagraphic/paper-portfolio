import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { useState } from "react";
import { TextMorph } from "torph/react";

const GLIDE = [0.32, 0.72, 0, 1] as const;
const SOFT = [0.4, 0, 0.2, 1] as const;

const terms = [
  {
    term: "Avg cost",
    meaning:
      "The share-weighted fill of the shares still held. A sell does not change it. Total return compares the mark with this cost, in the trading currency.",
  },
  {
    term: "Day return",
    meaning:
      "The mark minus the prior session's close, divided by that close. It is measured in the trading currency, so a move in that currency against the dollar does not change it.",
  },
  {
    term: "Total return",
    meaning:
      "The mark minus the average cost, divided by the average cost, for the shares still held. It stays in the trading currency.",
  },
  {
    term: "Day",
    meaning:
      "The dollar gain since the prior close: shares times the mark at today's FX, minus those shares at the prior close and that day's FX. The rate under it is the day return.",
  },
  {
    term: "Shares",
    meaning: "The shares still held. A buy adds to them and a sell removes them. A sold-out listing stays in the book at zero.",
  },
  {
    term: "Mark",
    meaning:
      "The price that values the position: the latest close, or the manual fill when no close is stored. A split after that close is applied before the mark is used.",
  },
  {
    term: "Market value",
    meaning: "Shares times the mark, converted to dollars with that session's FX. It is zero when no shares remain. Equity adds every market value to cash.",
  },
  {
    term: "Weight",
    meaning: "Market value divided by equity. It is the position's share of the whole book, including cash.",
  },
  {
    term: "Total",
    meaning:
      "The dollar gain on the shares still held: market value minus what those shares cost in dollars. When the listing is not in dollars, the first line is the same gain in the trading currency, without FX.",
  },
  {
    term: "Realized",
    meaning:
      "The dollar gain a sell locks in, using the FX on the buy dates and the sell date. It remains after those shares are gone and is not part of the total on the shares still held.",
  },
];

export function TermList() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  // Same feel as the trade form's fields: make room, then fade in; fade out, then give the room back.
  const show: Transition = reduceMotion
    ? { duration: 0 }
    : { height: { duration: 0.48, ease: GLIDE }, opacity: { duration: 0.38, delay: 0.12, ease: SOFT } };
  const hide: Transition = reduceMotion
    ? { duration: 0 }
    : { height: { duration: 0.42, delay: 0.1, ease: GLIDE }, opacity: { duration: 0.26, ease: SOFT } };

  return (
    <section className="term-list" aria-label="Listing terms">
      <button
        type="button"
        className="term-toggle"
        aria-expanded={open}
        aria-controls="term-table"
        onClick={() => setOpen((value) => !value)}
      >
        <TextMorph duration={380} ease="cubic-bezier(0.4, 0, 0.2, 1)">
          {open ? "Hide listing terms" : "Show listing terms"}
        </TextMorph>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="terms"
            id="term-table"
            className="term-reveal"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: show }}
            exit={{ height: 0, opacity: 0, transition: hide }}
          >
            <TermTable />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function TermTable() {
  return (
    <div className="term-table data-table">
      <table>
        <caption>Listing terms</caption>
        <thead>
          <tr>
            <th scope="col">Term</th>
            <th scope="col">Meaning</th>
          </tr>
        </thead>
        <tbody>
          {terms.map((term) => (
            <tr key={term.term}>
              <th scope="row">{term.term}</th>
              <td>{term.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
