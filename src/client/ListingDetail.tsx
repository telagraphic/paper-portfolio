import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
} from "lightweight-charts";
import type { ListingView } from "../book/book";
import { formatRate, formatShares, formatTrading, formatUsd, formatUsdOrBlank, gainTone, listingKey } from "./format";

export function ListingDetail({ listing }: { listing: ListingView | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const bars = listing?.bars ?? [];
  const key = bars.map((bar) => `${bar.date}:${bar.close}:${bar.volume}`).join("|");

  useEffect(() => {
    const element = ref.current;
    if (!element || bars.length === 0) return;
    const color = getComputedStyle(document.body).color;
    const up = cssColor("light-dark(#0b6a30, #8fd4a8)");
    const down = cssColor("light-dark(#8f1d1d, #f3b1b1)");
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
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
    });
    candles.setData(
      bars.map((bar) => ({
        time: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
    );
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
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
      <h2>{listing ? listingKey(listing) : "Listing"}</h2>
      <p className="listing-caption">
        {listing ? `Mark in ${listing.tradingCurrency}` : "Select a listing."}
      </p>
      {bars.length > 0 ? (
        <div className="chart-frame" ref={ref} role="img" aria-label="Selected listing daily bars" />
      ) : (
        <div className="chart-frame" role="img" aria-label="Selected listing daily bars">
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
          {listing.tradingCurrency !== "USD" ? (
            <div>
              <dt>Total gain, {listing.tradingCurrency}</dt>
              <dd className={gainTone(listing.totalGain)}>{formatTrading(listing.totalGain, listing.tradingCurrency)}</dd>
            </div>
          ) : null}
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
