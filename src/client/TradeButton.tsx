import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { TextMorph } from "torph/react";

export type TradePhase = "idle" | "busy" | "done";

type TradeButtonProps = {
  phase: TradePhase;
  label: string;
  disabled: boolean;
};

// The icon springs in heavy and settled, after Torph's own action demo.
const POP: Transition = { type: "spring", mass: 4, stiffness: 800, damping: 80, restDelta: 0.0001 };
const ICON_SIZE = 18;
const ICON_GAP = 8;

export function TradeButton({ phase, label, disabled }: TradeButtonProps) {
  const reduceMotion = useReducedMotion();
  const pop: Transition = reduceMotion ? { duration: 0 } : POP;

  return (
    <button type="submit" className="trade-submit" disabled={disabled} aria-busy={phase === "busy"} data-phase={phase}>
      <AnimatePresence initial={false}>
        {phase !== "idle" ? (
          <motion.span
            key="slot"
            className="trade-submit-slot"
            aria-hidden="true"
            initial={{ width: 0, marginRight: 0 }}
            animate={{ width: ICON_SIZE, marginRight: ICON_GAP }}
            exit={{ width: 0, marginRight: 0 }}
            transition={pop}
          >
            <AnimatePresence initial={false}>
              <motion.span
                key={phase}
                className="trade-submit-icon"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1, transition: reduceMotion ? pop : { ...POP, delay: 0.1 } }}
                exit={{ opacity: 0, scale: 0.6, transition: pop }}
              >
                {phase === "busy" ? <SpinnerIcon /> : <CheckIcon />}
              </motion.span>
            </AnimatePresence>
          </motion.span>
        ) : null}
      </AnimatePresence>
      <span className="trade-submit-label">
        <TextMorph duration={600} ease="cubic-bezier(0.41, 1.03, 0.6, 1.03)">
          {label}
        </TextMorph>
      </span>
    </button>
  );
}

function SpinnerIcon() {
  return (
    <svg className="trade-submit-spinner" viewBox="0 0 23 23" fill="none">
      <path
        opacity="0.2"
        d="M11.4065 21.313C16.8777 21.313 21.313 16.8777 21.313 11.4065C21.313 5.93529 16.8777 1.5 11.4065 1.5C5.93529 1.5 1.5 5.93529 1.5 11.4065C1.5 16.8777 5.93529 21.313 11.4065 21.313Z"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path d="M21.313 11.4062C21.313 16.8775 16.8777 21.3128 11.4065 21.3128" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 21 21" fill="none">
      <circle cx="10.5" cy="10.5" r="10.45" fill="currentColor" />
      <path
        d="M6.1 10.98L8.84 13.64L14.81 7.84"
        stroke="var(--color-button)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
