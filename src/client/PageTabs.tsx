import { useLayoutEffect, useRef, useState } from "react";

export type PageTab = "totals" | "tickers" | "trade" | "history" | "admin";

export type AdminTab = "cash" | "key" | "rules";

type TabOption<T extends string> = {
  id: T;
  label: string;
};

const pageTabs: TabOption<PageTab>[] = [
  { id: "totals", label: "Totals" },
  { id: "tickers", label: "Tickers" },
  { id: "trade", label: "Buy/Sell" },
  { id: "history", label: "History" },
  { id: "admin", label: "Admin" },
];

export const adminTabs: TabOption<AdminTab>[] = [
  { id: "cash", label: "Cash" },
  { id: "key", label: "API key" },
  { id: "rules", label: "Rules" },
];

type TabsProps<T extends string> = {
  tabs: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  idPrefix: string;
  tone?: "solid" | "subtle";
};

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
  tone = "solid",
}: TabsProps<T>) {
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
  }, [tabs, value]);

  return (
    <div
      ref={listRef}
      className={tone === "subtle" ? "page-tabs page-tabs-subtle" : "page-tabs"}
      role="tablist"
      aria-label={label}
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
          id={`${idPrefix}-tab-${tab.id}`}
          className="page-tab"
          aria-selected={value === tab.id}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
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

type PageTabsProps = {
  value: PageTab;
  onChange: (value: PageTab) => void;
};

export function PageTabs({ value, onChange }: PageTabsProps) {
  return <Tabs tabs={pageTabs} value={value} onChange={onChange} label="Portfolio" idPrefix="page" />;
}
