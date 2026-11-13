import { useEffect, useRef } from "react";
import type { Candle } from "../book/book";
import { mountAreaChart } from "./area-chart";
import {
  formatRate,
  formatShares,
  formatSignedRate,
  formatSignedTrading,
  formatSignedUsd,
  formatTrading,
  formatUsdOrBlank,
  gainTone,
  listingKey,
} from "./format";
import { displayName, type PageListing } from "./page-book";
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
            <span className="listing-symbol">{listingKey(listing)}</span>
            <span className="listing-title">{displayName(listing)}</span>
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
        >
          <span className="chart-last">{formatTrading(bars[bars.length - 1]?.close ?? 0, listing?.tradingCurrency ?? "USD")}</span>
        </div>
      ) : (
        <div className="chart-frame" data-state="ready" role="img" aria-label="Selected listing close">
          {listing ? "No session closes yet." : "Select a listing."}
        </div>
      )}
      {listing ? <ListingFigures listing={listing} /> : null}
    </section>
  );
}

function ListingFigures({ listing }: { listing: PageListing }) {
  const foreign = listing.tradingCurrency !== "USD";
  return (
    <dl className="listing-figures">
      <Figure label="Avg cost" value={formatTrading(listing.averageCost, listing.tradingCurrency)} />
      <Figure label="Day return" value={formatSignedRate(listing.dayReturn)} tone={gainTone(listing.dayReturn)} />
      <Figure label="Total return" value={formatSignedRate(listing.totalReturn)} tone={gainTone(listing.totalReturn)} />
      <div>
        <dt>Day</dt>
        <dd className={gainTone(listing.dayGainUsd)}>
          <span>{formatSignedUsd(listing.dayGainUsd)}</span>
          <span className="figure-sub">{formatSignedRate(listing.dayReturn)}</span>
        </dd>
      </div>
      <Figure label="Shares" value={formatShares(listing.shares)} />
      <Figure label="Mark" value={formatTrading(listing.mark, listing.tradingCurrency)} />
      <Figure label="Market value" value={formatUsdOrBlank(listing.marketValueUsd)} />
      <Figure label="Weight" value={formatRate(listing.weight)} />
      <div>
        <dt>Total</dt>
        <dd className={gainTone(listing.totalGainUsd)}>
          {foreign ? <span>{formatSignedTrading(listing.totalGain, listing.tradingCurrency)}</span> : null}
          <span className={foreign ? "figure-sub" : undefined}>{formatSignedUsd(listing.totalGainUsd)}</span>
        </dd>
      </div>
      <Figure label="Realized" value={formatSignedUsd(listing.realizedGainUsd)} tone={gainTone(listing.realizedGainUsd)} />
    </dl>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={tone}>{value}</dd>
    </div>
  );
}
