import NumberFlow, { continuous, type Format } from "@number-flow/react";
import { useEffect, useState } from "react";

const plugins = [continuous];

export const usdFormat: Format = { style: "currency", currency: "USD" };
export const rateFormat: Format = {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};
export const sharesFormat: Format = { maximumFractionDigits: 4 };

const plainFormat: Format = { maximumFractionDigits: 2 };
const tradingFormats = new Map<string, Format>();

let pageIntroPlayed = false;

export function tradingPresentation(currency: string) {
  if (currency === "GBX") return { format: plainFormat, suffix: "p" };
  return { format: currencyFormat(currency), suffix: currencyFormat(currency).style === "currency" ? undefined : ` ${currency}` };
}

function currencyFormat(currency: string) {
  const cached = tradingFormats.get(currency);
  if (cached) return cached;
  let format = plainFormat;
  try {
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(0);
    format = { style: "currency", currency };
  } catch {
    format = plainFormat;
  }
  tradingFormats.set(currency, format);
  return format;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useIntroNumber(value: number, intro: boolean) {
  const play = intro && !pageIntroPlayed && !prefersReducedMotion();
  const [shown, setShown] = useState(play ? 0 : value);

  useEffect(() => {
    if (!play) {
      setShown(value);
      return;
    }
    const frame = requestAnimationFrame(() => {
      pageIntroPlayed = true;
      setShown(value);
    });
    return () => cancelAnimationFrame(frame);
  }, [play, value]);

  return shown;
}

export function FlowValue({
  value,
  format,
  suffix,
  signed = false,
  intro = false,
}: {
  value: number | null;
  format: Format;
  suffix?: string;
  signed?: boolean;
  intro?: boolean;
}) {
  const missing = value == null || Number.isNaN(value);
  const magnitude = missing ? 0 : signed ? Math.abs(value) : value;
  const shown = useIntroNumber(magnitude, intro && !missing);
  if (missing) return "—";
  const prefix = !signed || value === 0 ? undefined : value > 0 ? "+" : "−";
  return (
    <NumberFlow
      value={shown}
      locales="en-US"
      format={format}
      prefix={prefix}
      suffix={suffix}
      plugins={plugins}
      respectMotionPreference
      willChange
      isolate
    />
  );
}
