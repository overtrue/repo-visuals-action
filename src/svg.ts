import { dayFromNumber, dayNumber, type StarHistory } from "./history.ts";
import {
  resolvePalette,
  themeFor,
  type ChartStyle,
  type ChartVariant,
  type Palette,
  type PaletteOverrides,
} from "./theme.ts";

export {
  CHART_STYLES,
  CHART_VARIANTS,
  validateChartStyle,
  validateChartVariant,
  validateColor,
  type ChartStyle,
  type ChartVariant,
  type PaletteOverrides,
} from "./theme.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FONT = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export interface SvgOptions {
  dark?: boolean;
  style?: ChartStyle;
  variant?: ChartVariant;
  animate?: boolean;
  smooth?: boolean;
  title?: string;
  overrides?: PaletteOverrides;
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

function groupThousands(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
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

function monthYear(day: string): string {
  const [year, monthText] = day.split("-");
  const month = MONTHS[Number(monthText) - 1];
  return month ? `${month} ${year}` : day;
}

// Fritsch–Carlson monotone cubic spline: a smooth curve that never overshoots
// the data, so a cumulative star line never dips below a previous value.
function smoothPath(points: Array<[number, number]>): string {
  if (points.length < 3) {
    return points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  }
  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const deltaX = points[i + 1]![0] - points[i]![0];
    dx.push(deltaX);
    slope.push(deltaX === 0 ? 0 : (points[i + 1]![1] - points[i]![1]) / deltaX);
  }
  const tangent: number[] = new Array(n).fill(0);
  tangent[0] = slope[0]!;
  tangent[n - 1] = slope[n - 2]!;
  for (let i = 1; i < n - 1; i += 1) {
    tangent[i] = slope[i - 1]! * slope[i]! <= 0 ? 0 : (slope[i - 1]! + slope[i]!) / 2;
  }
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i]! / slope[i]!;
    const b = tangent[i + 1]! / slope[i]!;
    const h = Math.hypot(a, b);
    if (h > 3) {
      const scale = 3 / h;
      tangent[i] = scale * a * slope[i]!;
      tangent[i + 1] = scale * b * slope[i]!;
    }
  }
  let path = `M ${points[0]![0].toFixed(1)} ${points[0]![1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const controlX1 = x0 + dx[i]! / 3;
    const controlY1 = y0 + (tangent[i]! * dx[i]!) / 3;
    const controlX2 = x1 - dx[i]! / 3;
    const controlY2 = y1 - (tangent[i + 1]! * dx[i]!) / 3;
    path += ` C ${controlX1.toFixed(1)} ${controlY1.toFixed(1)}, ${controlX2.toFixed(1)} ${controlY2.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return path;
}

function straightPath(points: Array<[number, number]>): string {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

function definitions(palette: Palette, variant: ChartVariant, animate: boolean): string[] {
  const elements = [
    "<defs>",
    `<linearGradient id="trend" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${palette.start}"/><stop offset="100%" stop-color="${palette.end}"/></linearGradient>`,
  ];
  if (variant !== "line") {
    elements.push(
      `<linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${palette.start}" stop-opacity="0.30"/><stop offset="55%" stop-color="${palette.end}" stop-opacity="0.10"/><stop offset="100%" stop-color="${palette.end}" stop-opacity="0.01"/></linearGradient>`,
    );
  }
  elements.push(
    `<radialGradient id="marker-halo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${palette.end}" stop-opacity="0.55"/><stop offset="100%" stop-color="${palette.end}" stop-opacity="0"/></radialGradient>`,
  );
  if (variant === "glow") {
    elements.push(
      `<radialGradient id="surface-glow" cx="78%" cy="14%" r="80%"><stop offset="0%" stop-color="${palette.end}" stop-opacity="0.14"/><stop offset="100%" stop-color="${palette.background}" stop-opacity="0"/></radialGradient>`,
      '<filter id="trend-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>',
    );
  }
  elements.push("</defs>");
  if (animate) {
    elements.push(
      "<style>",
      ".trend-enter{transform-box:fill-box;transform-origin:center;animation:trend-enter 520ms cubic-bezier(0.16,1,0.3,1)}",
      ".marker-enter{transform-box:fill-box;transform-origin:center;animation:marker-enter 320ms cubic-bezier(0.16,1,0.3,1) 200ms both}",
      ".marker-pulse{transform-box:fill-box;transform-origin:center;animation:marker-pulse 2.6s ease-out infinite}",
      "@keyframes trend-enter{from{opacity:.35;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes marker-enter{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}",
      "@keyframes marker-pulse{0%{opacity:.5;transform:scale(.7)}70%,100%{opacity:0;transform:scale(2.1)}}",
      "@media (prefers-reduced-motion:reduce){.trend-enter,.marker-enter,.marker-pulse{animation:none!important}}",
      "@media (prefers-reduced-motion:reduce){.marker-pulse{opacity:0}}",
      "</style>",
    );
  }
  return elements;
}

export function renderSvg(history: StarHistory, options: SvgOptions = {}): string {
  const dark = options.dark ?? false;
  const style = options.style ?? "classic";
  const variant = options.variant ?? themeFor(style).variant;
  const animate = options.animate ?? true;
  const smooth = options.smooth ?? true;
  const palette = resolvePalette(style, dark, options.overrides);
  const title = (options.title ?? "Star History").trim() || "Star History";

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
  const left = 76;
  const right = 40;
  const top = 104;
  const bottom = 60;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const onePoint = first.dayNumber === last.dayNumber;

  const coordinates = (day: number, count: number): [number, number] => [
    onePoint ? width - right : left + ((day - first.dayNumber) / dateSpan) * plotWidth,
    top + plotHeight - (count / yMaximum) * plotHeight,
  ];
  const points = parsed.map(({ dayNumber: day, count }) => coordinates(day, count));
  const linePath = smooth ? smoothPath(points) : straightPath(points);
  const firstCoordinates = points[0]!;
  const lastCoordinates = points.at(-1)!;
  const baseline = (top + plotHeight).toFixed(1);
  const areaPath = `${linePath} L ${lastCoordinates[0].toFixed(1)} ${baseline} L ${firstCoordinates[0].toFixed(1)} ${baseline} Z`;

  const trendClass = animate ? ' class="trend-enter"' : "";
  const markerClass = animate ? ' class="marker-enter"' : "";
  const pulseClass = animate ? ' class="marker-pulse"' : "";
  const cardRadius = variant === "line" ? 14 : 16;

  const elements = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description" data-style="${style}" data-variant="${variant}" data-animated="${animate}">`,
    `<title id="title">${escapeXml(history.repository)} ${escapeXml(title)}</title>`,
    `<desc id="description">${formatCount(last.count)} stars as of ${last.day}. Daily cumulative star trend.</desc>`,
    ...definitions(palette, variant, animate),
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="${palette.background}" stroke="${palette.grid}" stroke-width="1" rx="${cardRadius}"/>`,
  ];
  if (variant === "glow") {
    elements.push(`<rect width="${width}" height="${height}" fill="url(#surface-glow)" rx="${cardRadius}"/>`);
  }

  // Header: identity on the left, current total on the right.
  const iconFill = variant === "line" ? "none" : "url(#trend)";
  elements.push(
    `<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.7-4.6 6.5-.9L12 2.6Z" transform="translate(${left} 30) scale(.9)" fill="${iconFill}" stroke="url(#trend)" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"/>`,
    `<text x="${left + 34}" y="46" fill="${palette.foreground}" font-family="${FONT}" font-size="22" font-weight="700">${escapeXml(title)}</text>`,
    `<text x="${left + 34}" y="68" fill="${palette.muted}" font-family="${FONT}" font-size="13">${escapeXml(history.repository)}</text>`,
    `<text x="${width - right}" y="50" fill="${palette.foreground}" font-family="${FONT}" font-size="30" font-weight="700" text-anchor="end">${groupThousands(last.count)}</text>`,
    `<text x="${width - right}" y="70" fill="${palette.muted}" font-family="${FONT}" font-size="12" font-weight="500" letter-spacing="1.5" text-anchor="end">STARS</text>`,
  );

  // Horizontal grid + y axis labels.
  for (let value = 0; value <= yMaximum; value += yStep) {
    const y = top + plotHeight - (value / yMaximum) * plotHeight;
    elements.push(
      `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}" stroke="${palette.grid}" stroke-width="1" stroke-dasharray="${value === 0 ? "0" : "4 6"}" opacity="${value === 0 ? "1" : "0.7"}"/>`,
      `<text x="${left - 12}" y="${(y + 4).toFixed(1)}" fill="${palette.muted}" font-family="${FONT}" font-size="13" text-anchor="end">${formatCount(value)}</text>`,
    );
  }

  const longRange = last.dayNumber - first.dayNumber > 90;
  for (const tick of dateTicks(first.dayNumber, last.dayNumber)) {
    const [x] = coordinates(tick, 0);
    elements.push(
      `<text x="${x.toFixed(1)}" y="${top + plotHeight + 28}" fill="${palette.muted}" font-family="${FONT}" font-size="13" text-anchor="middle">${dateLabel(dayFromNumber(tick), longRange)}</text>`,
    );
  }

  // Trend.
  elements.push(`<g${trendClass}>`);
  if (variant !== "line") {
    elements.push(`<path d="${areaPath}" fill="url(#area)"/>`);
  }
  if (variant === "glow") {
    elements.push(
      `<path d="${linePath}" fill="none" stroke="url(#trend)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity="0.16" filter="url(#trend-glow)"/>`,
    );
  }
  elements.push(
    `<path d="${linePath}" fill="none" stroke="url(#trend)" stroke-width="${variant === "line" ? 2.5 : 3}" stroke-linecap="round" stroke-linejoin="round"/>`,
    "</g>",
  );

  // Endpoint marker with a soft halo (fixes the old value-label collision).
  elements.push(
    `<g${markerClass}>`,
    `<circle${pulseClass} cx="${lastCoordinates[0].toFixed(1)}" cy="${lastCoordinates[1].toFixed(1)}" r="9" fill="url(#marker-halo)"/>`,
    `<circle cx="${lastCoordinates[0].toFixed(1)}" cy="${lastCoordinates[1].toFixed(1)}" r="4.5" fill="${palette.end}" stroke="${palette.background}" stroke-width="2"/>`,
    "</g>",
  );

  // Footer: tracked range on the left, refresh date on the right.
  const rangeLabel = onePoint ? monthYear(last.day) : `${monthYear(first.day)} – ${monthYear(last.day)}`;
  elements.push(
    `<text x="${left}" y="${height - 18}" fill="${palette.muted}" font-family="${FONT}" font-size="12" font-weight="500">${rangeLabel}</text>`,
    `<text x="${width - right}" y="${height - 18}" fill="${palette.muted}" font-family="${FONT}" font-size="12" font-weight="500" text-anchor="end">Updated ${last.day}</text>`,
    "</svg>",
  );
  return `${elements.join("\n")}\n`;
}
