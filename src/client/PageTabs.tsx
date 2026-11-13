import { useLayoutEffect, useRef, useState } from "react";

export type PageTab = "totals" | "tickers" | "trade";

const tabs: { id: PageTab; label: string }[] = [
  { id: "totals", label: "Totals" },
  { id: "tickers", label: "Tickers" },
  { id: "trade", label: "Buy/Sell" },
];

type PageTabsProps = {
  value: PageTab;
  onChange: (value: PageTab) => void;
};

export function PageTabs({ value, onChange }: PageTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    const selected = tabs.findIndex((tab) => tab.id === value);
    const button = buttons.current[selected];
    if (!list || !button) return;

    const measure = () => {
      setPill({ left: button.offsetLeft, width: button.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    const frame = requestAnimationFrame(() => setReady(true));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <div
      ref={listRef}
      className="page-tabs"
      role="tablist"
      aria-label="Portfolio"
      data-ready={ready ? "true" : "false"}
    >
      <span className="page-tab-pill" style={{ left: pill.left, width: pill.width }} aria-hidden="true" />
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          type="button"
          role="tab"
          id={`page-tab-${tab.id}`}
          className="page-tab"
          aria-selected={value === tab.id}
          aria-controls={`page-panel-${tab.id}`}
          tabIndex={value === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            if (!direction) return;
            event.preventDefault();
            const next = (index + direction + tabs.length) % tabs.length;
            onChange(tabs[next].id);
            buttons.current[next]?.focus();
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
