import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, createChart, HistogramSeries } from "lightweight-charts";
import type { Candle, ListingView } from "../book/book";
import { formatRate, formatShares, formatTrading, formatUsd, formatUsdOrBlank, gainTone, listingKey } from "./format";
import { useChartFrame } from "./useChartFrame";

const noBars: Candle[] = [];

export function ListingDetail({ listing }: { listing: ListingView | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const bars = listing?.bars ?? noBars;
  const key = `${listing ? listingKey(listing) : "none"}:${bars.map((bar) => `${bar.date}:${bar.close}:${bar.volume}`).join("|")}`;
  const state = useChartFrame(key);

  useEffect(() => {
    const element = ref.current;
    if (!element || bars.length === 0) return;
    const color = getComputedStyle(document.body).color;
    const line = cssColor("var(--color-fg)");
    const up = cssColor("var(--color-up)");
    const down = cssColor("var(--color-down)");
    const chart = createChart(element, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: color,
        fontFamily: getComputedStyle(document.body).fontFamily,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.28 } },
      timeScale: { borderVisible: false },
    });
    const area = chart.addSeries(AreaSeries, {
      lineColor: line,
      topColor: fade(line, 0.28),
      bottomColor: fade(line, 0),
      lineWidth: 2,
    });
    area.setData(bars.map((bar) => ({ time: bar.date, value: bar.close })));
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });
    volume.setData(
      bars.map((bar) => ({
        time: bar.date,
        value: bar.volume,
        color: bar.close >= bar.open ? up : down,
      })),
    );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, key]);

  return (
    <section className="listing-detail" aria-label="Listing detail">
      <h2>
        {listing ? (
          <>
            {listing.symbol}
            <span className="listing-meta">
              {listing.exchange} · {listing.tradingCurrency}
            </span>
          </>
        ) : (
          "Listing"
        )}
      </h2>
      {bars.length > 0 ? (
        <div
          className="chart-frame"
          data-state={state}
          ref={ref}
          role="img"
          aria-label="Selected listing close"
          aria-busy={state === "loading"}
        />
      ) : (
        <div className="chart-frame" data-state="ready" role="img" aria-label="Selected listing close">
          {listing ? "No session closes yet." : "Select a listing."}
        </div>
      )}
      {listing ? (
        <dl>
          <div>
            <dt>Shares</dt>
            <dd>{formatShares(listing.shares)}</dd>
          </div>
          <div>
            <dt>Average cost</dt>
            <dd>{formatTrading(listing.averageCost, listing.tradingCurrency)}</dd>
          </div>
          <div>
            <dt>Mark</dt>
            <dd>{formatTrading(listing.mark, listing.tradingCurrency)}</dd>
          </div>
          <div>
            <dt>Market value</dt>
            <dd>{formatUsdOrBlank(listing.marketValueUsd)}</dd>
          </div>
          <div>
            <dt>Weight</dt>
            <dd>{formatRate(listing.weight)}</dd>
          </div>
          <div>
            <dt>Day gain</dt>
            <dd className={gainTone(listing.dayGainUsd)}>{formatUsdOrBlank(listing.dayGainUsd)}</dd>
          </div>
          <div>
            <dt>Total gain</dt>
            <dd className={gainTone(listing.totalGainUsd)}>{formatUsdOrBlank(listing.totalGainUsd)}</dd>
          </div>
          <div>
            <dt>Realized gain</dt>
            <dd className={gainTone(listing.realizedGainUsd)}>{formatUsd(listing.realizedGainUsd)}</dd>
          </div>
          <div>
            <dt>Day return</dt>
            <dd>{formatRate(listing.dayReturn)}</dd>
          </div>
          <div>
            <dt>Total return</dt>
            <dd className={gainTone(listing.totalReturn)}>{formatRate(listing.totalReturn)}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

function cssColor(value: string): string {
  const probe = document.createElement("span");
  probe.style.color = value;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function fade(color: string, alpha: number) {
  const channels = color.match(/[\d.]+/g);
  if (!channels || channels.length < 3) return color;
  const [red, green, blue] = channels;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
