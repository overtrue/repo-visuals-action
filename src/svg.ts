import { dayFromNumber, dayNumber, type StarHistory } from "./history.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

export function renderSvg(history: StarHistory, dark = false): string {
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
  const left = 86;
  const right = 34;
  const top = 74;
  const bottom = 66;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const palette = dark
    ? { background: "#0d1117", foreground: "#e6edf3", muted: "#8b949e", grid: "#30363d", area: "#e05d44" }
    : { background: "#ffffff", foreground: "#24292f", muted: "#57606a", grid: "#d8dee4", area: "#d84a3a" };

  const coordinates = (day: number, count: number): [number, number] => [
    left + ((day - first.dayNumber) / dateSpan) * plotWidth,
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
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const elements = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">`,
    `<title id="title">${history.repository} star history</title>`,
    `<desc id="description">${formatCount(last.count)} stars as of ${last.day}</desc>`,
    "<defs>",
    `<linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${palette.area}" stop-opacity="0.30"/><stop offset="100%" stop-color="${palette.area}" stop-opacity="0.03"/></linearGradient>`,
    "</defs>",
    `<rect width="${width}" height="${height}" fill="${palette.background}" rx="12"/>`,
    `<text x="${left}" y="36" fill="${palette.foreground}" font-family="${font}" font-size="22" font-weight="650">Star History</text>`,
    `<text x="${left}" y="58" fill="${palette.muted}" font-family="${font}" font-size="14">${history.repository}</text>`,
  ];

  for (let value = 0; value <= yMaximum; value += yStep) {
    const y = top + plotHeight - (value / yMaximum) * plotHeight;
    elements.push(
      `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}" stroke="${palette.grid}" stroke-width="1"/>`,
      `<text x="${left - 12}" y="${(y + 5).toFixed(1)}" fill="${palette.muted}" font-family="${font}" font-size="13" text-anchor="end">${formatCount(value)}</text>`,
    );
  }

  const longRange = last.dayNumber - first.dayNumber > 90;
  for (const tick of dateTicks(first.dayNumber, last.dayNumber)) {
    const [x] = coordinates(tick, 0);
    const day = dayFromNumber(tick);
    elements.push(
      `<text x="${x.toFixed(1)}" y="${top + plotHeight + 30}" fill="${palette.muted}" font-family="${font}" font-size="13" text-anchor="middle">${dateLabel(day, longRange)}</text>`,
    );
  }

  elements.push(
    `<path d="${areaPath}" fill="url(#area)"/>`,
    `<path d="${linePath}" fill="none" stroke="${palette.area}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="${lastCoordinates[0].toFixed(1)}" cy="${lastCoordinates[1].toFixed(1)}" r="5" fill="${palette.area}" stroke="${palette.background}" stroke-width="2"/>`,
    `<text x="${(lastCoordinates[0] - 8).toFixed(1)}" y="${Math.max(top + 16, lastCoordinates[1] - 12).toFixed(1)}" fill="${palette.area}" font-family="${font}" font-size="15" font-weight="650" text-anchor="end">${formatCount(last.count)}</text>`,
    `<text x="${width - right}" y="${height - 18}" fill="${palette.muted}" font-family="${font}" font-size="12" text-anchor="end">Updated ${last.day}</text>`,
    "</svg>",
  );
  return `${elements.join("\n")}\n`;
}
