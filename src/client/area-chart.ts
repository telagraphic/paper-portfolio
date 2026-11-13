import { AreaSeries, ColorType, createChart, TickMarkType, type Time } from "lightweight-charts";

export function mountAreaChart(element: HTMLElement, points: { time: Time; value: number }[]) {
  const muted = cssColor("var(--color-muted)");
  const line = cssColor("var(--color-chart)");
  const chart = createChart(element, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: muted,
      fontFamily: "Geist Mono, ui-monospace, monospace",
      fontSize: 11,
      attributionLogo: false,
    },
    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    leftPriceScale: { visible: false },
    rightPriceScale: { visible: false, scaleMargins: { top: 0.18, bottom: 0.08 } },
    timeScale: { borderVisible: false, tickMarkFormatter: formatTick },
    handleScroll: false,
    handleScale: false,
  });
  const area = chart.addSeries(AreaSeries, {
    lineColor: line,
    topColor: fade(line, 0.34),
    bottomColor: fade(line, 0),
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  area.setData(points);
  chart.timeScale().fitContent();
  return chart;
}

function formatTick(time: Time, tickMarkType: TickMarkType) {
  const date = timeToDate(time);
  if (Number.isNaN(date.getTime())) return "";
  if (tickMarkType === TickMarkType.Year) return String(date.getUTCFullYear());
  if (tickMarkType === TickMarkType.Month) {
    return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  }
  return date.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function timeToDate(time: Time) {
  if (typeof time === "number") return new Date(time * 1000);
  if (typeof time === "string") return new Date(`${time}T00:00:00Z`);
  return new Date(Date.UTC(time.year, time.month - 1, time.day));
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
