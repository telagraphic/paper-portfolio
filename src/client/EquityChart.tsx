import { useEffect, useRef } from "react";
import { ColorType, createChart, LineSeries, type UTCTimestamp } from "lightweight-charts";
import type { EquityPoint } from "../book/book";

export function EquityChart({ series }: { series: EquityPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = series.map((point) => `${point.time}:${point.equityUsd}`).join("|");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const color = getComputedStyle(document.body).color;
    const chart = createChart(element, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: color,
        fontFamily: getComputedStyle(document.body).fontFamily,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    const line = chart.addSeries(LineSeries, { color, lineWidth: 2 });
    line.setData(series.map((point) => ({ time: point.time as UTCTimestamp, value: point.equityUsd })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [key, series]);

  return (
    <figure className="equity-chart">
      <figcaption>
        <h2>Equity</h2>
        <p>Cash plus open positions, in USD</p>
      </figcaption>
      <div className="chart-frame" ref={ref} role="img" aria-label="Equity in US dollars" />
    </figure>
  );
}
