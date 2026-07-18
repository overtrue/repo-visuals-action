import { dayFromNumber, dayNumber, type StarHistory } from "./history.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const CHART_STYLES = ["classic", "minimal", "gradient"] as const;
export type ChartStyle = (typeof CHART_STYLES)[number];

export interface SvgOptions {
  dark?: boolean;
  style?: ChartStyle;
  animate?: boolean;
}

interface Palette {
  background: string;
  foreground: string;
  muted: string;
  grid: string;
  start: string;
  end: string;
}

const PALETTES: Record<ChartStyle, { light: Palette; dark: Palette }> = {
  classic: {
    light: {
      background: "#ffffff",
      foreground: "#24292f",
      muted: "#57606a",
      grid: "#d8dee4",
      start: "#d84a3a",
      end: "#d84a3a",
    },
    dark: {
      background: "#0d1117",
      foreground: "#e6edf3",
      muted: "#8b949e",
      grid: "#30363d",
      start: "#e05d44",
      end: "#e05d44",
    },
  },
  minimal: {
    light: {
      background: "#ffffff",
      foreground: "#24292f",
      muted: "#57606a",
      grid: "#d8dee4",
      start: "#2563eb",
      end: "#2563eb",
    },
    dark: {
      background: "#0d1117",
      foreground: "#e6edf3",
      muted: "#8b949e",
      grid: "#30363d",
      start: "#60a5fa",
      end: "#60a5fa",
    },
  },
  gradient: {
    light: {
      background: "#f8fafc",
      foreground: "#172033",
      muted: "#526072",
      grid: "#dbe4ee",
      start: "#059669",
      end: "#0284c7",
    },
    dark: {
      background: "#0f172a",
      foreground: "#f8fafc",
      muted: "#94a3b8",
      grid: "#27364a",
      start: "#3ecf8e",
      end: "#38bdf8",
    },
  },
};

export function validateChartStyle(value: string): ChartStyle {
  if ((CHART_STYLES as readonly string[]).includes(value)) {
    return value as ChartStyle;
  }
  throw new Error(`chart-style must be one of: ${CHART_STYLES.join(", ")}`);
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) {
    return `${Number((value / 1_000_000).toFixed(1))}M`;
  }
  if (value >= 1_000) {
    return `${Number((value / 1_000).toFixed(1))}K`;
  }
  return String(value);
}

export function axisScale(maximum: number): [maximum: number, step: number] {
  if (maximum <= 0) {
    return [1, 1];
  }
  const roughStep = maximum / 5;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const stepFactor = [1, 2, 5, 10].find((value) => normalized <= value) ?? 10;
  const step = Math.max(1, Math.floor(stepFactor * magnitude));
  return [Math.ceil(maximum / step) * step, step];
}

function dateTicks(first: number, last: number, count = 6): number[] {
  const span = last - first;
  if (span <= 0) {
    return [first];
  }
  return [...new Set(Array.from({ length: count }, (_, index) => first + Math.round((span * index) / (count - 1))))].sort(
    (left, right) => left - right,
  );
}

function dateLabel(day: string, longRange: boolean): string {
  const [, monthText, dateText] = day.split("-");
  const month = MONTHS[Number(monthText) - 1];
  if (!month) {
    throw new Error(`invalid chart date: ${day}`);
  }
  return longRange ? `${month} ${day.slice(0, 4)}` : `${month} ${dateText}`;
}

function definitions(palette: Palette, style: ChartStyle, animate: boolean): string[] {
  const elements = [
    "<defs>",
    `<linearGradient id="trend" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${palette.start}"/><stop offset="100%" stop-color="${palette.end}"/></linearGradient>`,
  ];
  if (style !== "minimal") {
    elements.push(
      `<linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${palette.start}" stop-opacity="0.28"/><stop offset="60%" stop-color="${palette.end}" stop-opacity="0.10"/><stop offset="100%" stop-color="${palette.end}" stop-opacity="0.02"/></linearGradient>`,
    );
  }
  if (style === "gradient") {
    elements.push(
      `<radialGradient id="surface-glow" cx="76%" cy="18%" r="72%"><stop offset="0%" stop-color="${palette.end}" stop-opacity="0.12"/><stop offset="100%" stop-color="${palette.background}" stop-opacity="0"/></radialGradient>`,
      '<filter id="trend-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>',
    );
  }
  elements.push("</defs>");
  if (animate) {
    elements.push(
      "<style>",
      ".trend-enter{transform-box:fill-box;transform-origin:center;animation:trend-enter 480ms cubic-bezier(0.16,1,0.3,1)}",
      ".marker-enter{transform-box:fill-box;transform-origin:center;animation:marker-enter 300ms cubic-bezier(0.16,1,0.3,1)}",
      "@keyframes trend-enter{from{opacity:.4;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes marker-enter{from{opacity:.6;transform:scale(.82)}to{opacity:1;transform:scale(1)}}",
      "@media (prefers-reduced-motion:reduce){.trend-enter,.marker-enter{animation:none!important}}",
      "</style>",
    );
  }
  return elements;
}

export function renderSvg(history: StarHistory, options: SvgOptions = {}): string {
  const dark = options.dark ?? false;
  const style = options.style ?? "classic";
  const animate = options.animate ?? true;
  const parsed = history.points.map(([day, count]) => ({ day, dayNumber: dayNumber(day), count }));
  const first = parsed[0];
  const last = parsed.at(-1);
  if (!first || !last) {
    throw new Error("star history must contain at least one point");
  }

  const domainLast = Math.max(last.dayNumber, first.dayNumber + 1);
  const dateSpan = domainLast - first.dayNumber;
  const maximum = Math.max(...parsed.map(({ count }) => count));
  const [yMaximum, yStep] = axisScale(maximum);
  const width = 960;
  const height = 540;
  const left = 80;
  const right = 32;
  const top = 72;
  const bottom = 64;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const palette = PALETTES[style][dark ? "dark" : "light"];
  const onePoint = first.dayNumber === last.dayNumber;

  const coordinates = (day: number, count: number): [number, number] => [
    onePoint ? width - right : left + ((day - first.dayNumber) / dateSpan) * plotWidth,
    top + plotHeight - (count / yMaximum) * plotHeight,
  ];
  const points = parsed.map(({ dayNumber: day, count }) => coordinates(day, count));
  const linePath = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const firstCoordinates = points[0];
  const lastCoordinates = points.at(-1);
  if (!firstCoordinates || !lastCoordinates) {
    throw new Error("star history must contain at least one point");
  }
  const areaPath = `${linePath} L ${lastCoordinates[0].toFixed(1)} ${(top + plotHeight).toFixed(1)} L ${firstCoordinates[0].toFixed(1)} ${(top + plotHeight).toFixed(1)} Z`;
  const font = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const trendClass = animate ? ' class="trend-enter"' : "";
  const markerClass = animate ? ' class="marker-enter"' : "";
  const starFill = style === "minimal" ? "none" : "url(#trend)";
  const elements = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description" data-style="${style}" data-animated="${animate}">`,
    `<title id="title">${history.repository} star history</title>`,
    `<desc id="description">${formatCount(last.count)} stars as of ${last.day}. Daily cumulative star trend.</desc>`,
    ...definitions(palette, style, animate),
    `<rect width="${width}" height="${height}" fill="${palette.background}" rx="${style === "gradient" ? 16 : 12}"/>`,
  ];
  if (style === "gradient") {
    elements.push(`<rect width="${width}" height="${height}" fill="url(#surface-glow)" rx="16"/>`);
  }
  elements.push(
    `<path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 2.8Z" transform="translate(${left} 18) scale(.82)" fill="${starFill}" stroke="url(#trend)" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"/>`,
    `<text x="${left + 32}" y="40" fill="${palette.foreground}" font-family="${font}" font-size="24" font-weight="600">Star History</text>`,
    `<text x="${left + 32}" y="60" fill="${palette.muted}" font-family="${font}" font-size="14">${history.repository}</text>`,
  );

  for (let value = 0; value <= yMaximum; value += yStep) {
    const y = top + plotHeight - (value / yMaximum) * plotHeight;
    elements.push(
      `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}" stroke="${palette.grid}" stroke-width="1"/>`,
      `<text x="${left - 12}" y="${(y + 5).toFixed(1)}" fill="${palette.muted}" font-family="${font}" font-size="14" text-anchor="end">${formatCount(value)}</text>`,
    );
  }

  const longRange = last.dayNumber - first.dayNumber > 90;
  for (const tick of dateTicks(first.dayNumber, last.dayNumber)) {
    const [x] = coordinates(tick, 0);
    const day = dayFromNumber(tick);
    elements.push(
      `<text x="${x.toFixed(1)}" y="${top + plotHeight + 32}" fill="${palette.muted}" font-family="${font}" font-size="14" text-anchor="middle">${dateLabel(day, longRange)}</text>`,
    );
  }

  elements.push(`<g${trendClass}>`);
  if (style !== "minimal") {
    elements.push(`<path d="${areaPath}" fill="url(#area)"/>`);
  }
  if (style === "gradient") {
    elements.push(
      `<path d="${linePath}" fill="none" stroke="url(#trend)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity="0.18" filter="url(#trend-glow)"/>`,
    );
  }
  elements.push(
    `<path d="${linePath}" fill="none" stroke="url(#trend)" stroke-width="${style === "minimal" ? 2 : 3}" stroke-linecap="round" stroke-linejoin="round"/>`,
    "</g>",
    `<g${markerClass}>`,
    `<circle cx="${lastCoordinates[0].toFixed(1)}" cy="${lastCoordinates[1].toFixed(1)}" r="5" fill="${palette.end}" stroke="${palette.background}" stroke-width="2"/>`,
    `<text x="${(lastCoordinates[0] - 8).toFixed(1)}" y="${Math.max(top + 16, lastCoordinates[1] - 12).toFixed(1)}" fill="${palette.end}" font-family="${font}" font-size="16" font-weight="600" text-anchor="end">${formatCount(last.count)}</text>`,
    "</g>",
    `<text x="${width - right}" y="${height - 16}" fill="${palette.muted}" font-family="${font}" font-size="12" font-weight="500" text-anchor="end">Updated ${last.day}</text>`,
    "</svg>",
  );
  return `${elements.join("\n")}\n`;
}
