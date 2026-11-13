import { useEffect, useRef } from "react";
import type { UTCTimestamp } from "lightweight-charts";
import type { EquityPoint } from "../book/book";
import { mountAreaChart } from "./area-chart";
import { formatUsd } from "./format";
import { useChartFrame } from "./useChartFrame";

export function EquityChart({ series }: { series: EquityPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = series.map((point) => `${point.time}:${point.equityUsd}`).join("|");
  const state = useChartFrame(key);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let chart: ReturnType<typeof mountAreaChart> | null = null;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      chart = mountAreaChart(
        element,
        series.map((point) => ({ time: point.time as UTCTimestamp, value: point.equityUsd })),
      );
    });
    return () => {
      cancelled = true;
      chart?.remove();
    };
  }, [key, series]);

  return (
    <figure className="equity-chart">
      <div
        className="chart-frame"
        data-state={state}
        ref={ref}
        role="img"
        aria-label="Equity in US dollars"
        aria-busy={state === "loading"}
      >
        {series.length > 0 ? <span className="chart-last">{formatUsd(series[series.length - 1]?.equityUsd ?? 0)}</span> : null}
      </div>
    </figure>
  );
}
