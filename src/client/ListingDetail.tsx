import { useEffect, useRef } from "react";
import type { Candle } from "../book/book";
import { mountAreaChart } from "./area-chart";
import type { Format } from "@number-flow/react";
import { FlowValue, rateFormat, sharesFormat, tradingPresentation, usdFormat } from "./FlowValue";
import { formatTrading, gainTone, listingKey } from "./format";
import { displaySymbol, distinctName, type PageListing } from "./page-book";
import { useChartFrame } from "./useChartFrame";

const noBars: Candle[] = [];

export function ListingDetail({ listing }: { listing: PageListing | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const bars = listing?.bars ?? noBars;
  const key = `${listing ? listingKey(listing) : "none"}:${bars.map((bar) => `${bar.date}:${bar.close}`).join("|")}`;
  const state = useChartFrame(key);

  useEffect(() => {
    const element = ref.current;
    if (!element || bars.length === 0) return;
    let chart: ReturnType<typeof mountAreaChart> | null = null;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      chart = mountAreaChart(
        element,
        bars.map((bar) => ({ time: bar.date, value: bar.close })),
      );
    });
    return () => {
      cancelled = true;
      chart?.remove();
    };
  }, [bars, key]);

  return (
    <section className="listing-detail" aria-label="Listing detail">
      <h2>
        {listing ? (
          <>
            <span className="listing-symbol">{displaySymbol(listing)}</span>
            {distinctName(listing) ? <span className="listing-title">{distinctName(listing)}</span> : null}
            <span className="listing-meta">
              {listing.exchange === "US" ? `US · ${listing.tradingCurrency}` : listing.tradingCurrency}
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
        >
          <span className="chart-last">{formatTrading(bars[bars.length - 1]?.close ?? 0, listing?.tradingCurrency ?? "USD")}</span>
        </div>
      ) : (
        <div className="chart-frame" data-state="ready" role="img" aria-label="Selected listing close">
          {listing ? "No session closes yet." : "Select a listing."}
        </div>
      )}
    </section>
  );
}

export function ListingFigures({ listing }: { listing: PageListing }) {
  const trading = tradingPresentation(listing.tradingCurrency);
  const foreign = listing.tradingCurrency !== "USD";
  return (
    <dl className="listing-figures">
      <Figure label="Avg cost" value={listing.averageCost} format={trading.format} suffix={trading.suffix} />
      <div className="listing-figure-pair">
        <Figure label="Day return" value={listing.dayReturn} format={rateFormat} signed tone={gainTone(listing.dayReturn)} />
        <Figure label="Total return" value={listing.totalReturn} format={rateFormat} signed tone={gainTone(listing.totalReturn)} />
      </div>
      <div>
        <dt>Day</dt>
        <dd className={gainTone(listing.dayGainUsd)}>
          <FlowValue value={listing.dayGainUsd} format={usdFormat} signed />
          <span className="figure-sub">
            <FlowValue value={listing.dayReturn} format={rateFormat} signed />
          </span>
        </dd>
      </div>
      <Figure label="Shares" value={listing.shares} format={sharesFormat} />
      <Figure label="Mark" value={listing.mark} format={trading.format} suffix={trading.suffix} />
      <Figure label="Market value" value={listing.marketValueUsd} format={usdFormat} />
      <Figure label="Weight" value={listing.weight} format={rateFormat} />
      <div>
        <dt>Total</dt>
        <dd className={gainTone(listing.totalGainUsd)}>
          {foreign ? <FlowValue value={listing.totalGain} format={trading.format} suffix={trading.suffix} signed /> : null}
          <span className={foreign ? "figure-sub" : undefined}>
            <FlowValue value={listing.totalGainUsd} format={usdFormat} signed />
          </span>
        </dd>
      </div>
      <Figure label="Realized" value={listing.realizedGainUsd} format={usdFormat} signed tone={gainTone(listing.realizedGainUsd)} />
    </dl>
  );
}

function Figure({
  label,
  value,
  format,
  suffix,
  signed,
  tone,
}: {
  label: string;
  value: number | null;
  format: Format;
  suffix?: string;
  signed?: boolean;
  tone?: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={tone}>
        <FlowValue value={value} format={format} suffix={suffix} signed={signed} />
      </dd>
    </div>
  );
}
