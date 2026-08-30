import { resolvePalette, type ChartStyle, type PaletteOverrides } from "./theme.ts";

export const DEFAULT_CONTRIBUTORS_LIMIT = 150;
export const MAX_CONTRIBUTORS_LIMIT = 200;

export const AVATAR_SHAPES = ["circle", "squircle", "square"] as const;
export type AvatarShape = (typeof AVATAR_SHAPES)[number];

export interface Contributor {
  login: string;
  contributions: number;
  avatarDataUrl: string | null;
}

export interface ContributorLayout {
  avatarSize: number;
  gap: number;
  columns: number;
  padding: number;
  shape: AvatarShape;
}

export const DEFAULT_CONTRIBUTOR_LAYOUT: ContributorLayout = {
  avatarSize: 48,
  gap: 8,
  columns: 16,
  padding: 32,
  shape: "circle",
};

export interface ContributorSvgOptions {
  dark?: boolean;
  style?: ChartStyle;
  animate?: boolean;
  title?: string;
  overrides?: PaletteOverrides;
  layout?: Partial<ContributorLayout>;
}

const AVATAR_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const FONT = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export function validateContributorsLimit(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error("contributors-limit must be an integer");
  }
  const limit = Number(value);
  if (limit < 1 || limit > MAX_CONTRIBUTORS_LIMIT) {
    throw new Error(`contributors-limit must be between 1 and ${MAX_CONTRIBUTORS_LIMIT}`);
  }
  return limit;
}

function validateInteger(value: string, label: string, min: number, max: number): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`${label} must be an integer`);
  }
  const parsed = Number(value);
  if (parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return parsed;
}

export function validateAvatarSize(value: string): number {
  return validateInteger(value, "avatar-size", 24, 128);
}

export function validateAvatarGap(value: string): number {
  return validateInteger(value, "avatar-gap", 0, 48);
}

export function validateContributorsColumns(value: string): number {
  return validateInteger(value, "contributors-columns", 4, 32);
}

export function validatePadding(value: string): number {
  return validateInteger(value, "padding", 8, 96);
}

export function validateAvatarShape(value: string): AvatarShape {
  if ((AVATAR_SHAPES as readonly string[]).includes(value)) {
    return value as AvatarShape;
  }
  throw new Error(`avatar-shape must be one of: ${AVATAR_SHAPES.join(", ")}`);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cornerRadius(shape: AvatarShape, size: number): number {
  if (shape === "circle") {
    return size / 2;
  }
  if (shape === "squircle") {
    return Math.round(size * 0.3);
  }
  return Math.round(size * 0.16);
}

export function renderContributorsSvg(
  contributors: Contributor[],
  repository: string,
  options: ContributorSvgOptions = {},
): string {
  const dark = options.dark ?? false;
  const style = options.style ?? "classic";
  const animate = options.animate ?? true;
  const palette = resolvePalette(style, dark, options.overrides);
  const title = (options.title ?? "Contributors").trim() || "Contributors";
  const layout = { ...DEFAULT_CONTRIBUTOR_LAYOUT, ...options.layout };
  const { avatarSize, gap, columns, padding, shape } = layout;
  const radius = cornerRadius(shape, avatarSize);

  const headerHeight = 82;
  const gridTop = padding + headerHeight;
  const rows = Math.max(1, Math.ceil(contributors.length / columns));
  const gridHeight = contributors.length === 0 ? 72 : rows * avatarSize + (rows - 1) * gap;
  // Keep the card wide enough for the header even with narrow avatar grids.
  const width = Math.max(420, padding * 2 + columns * avatarSize + (columns - 1) * gap);
  const height = gridTop + gridHeight + padding;
  const cardRadius = 18;
  const headerOffset = Math.max(0, 22 - padding);

  const countLabel = `${contributors.length} ${contributors.length === 1 ? "contributor" : "contributors"}`;
  const topContributors = contributors.slice(0, 10).map(({ login }) => login).join(", ");
  const description = contributors.length === 0
    ? `No contributors found for ${repository}.`
    : `${countLabel} for ${repository}. Top contributors: ${topContributors}.`;
  const wallClass = animate ? ' class="wall-enter"' : "";

  const elements = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description" data-style="${style}" data-shape="${shape}" data-animated="${animate}">`,
    `<title id="title">${escapeXml(repository)} ${escapeXml(title)}</title>`,
    `<desc id="description">${escapeXml(description)}</desc>`,
    "<defs>",
    `<linearGradient id="wall-accent" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${palette.start}"/><stop offset="100%" stop-color="${palette.end}"/></linearGradient>`,
    `<clipPath id="avatar-clip"><rect width="${avatarSize}" height="${avatarSize}" rx="${radius}"/></clipPath>`,
    `<radialGradient id="wall-surface-glow" cx="84%" cy="0%" r="76%"><stop offset="0%" stop-color="${palette.end}" stop-opacity="0.06"/><stop offset="100%" stop-color="${palette.background}" stop-opacity="0"/></radialGradient>`,
    "</defs>",
  ];
  if (animate) {
    elements.push(
      "<style>",
      ".wall-enter{transform-box:fill-box;transform-origin:center;animation:wall-enter 520ms cubic-bezier(0.16,1,0.3,1)}",
      "@keyframes wall-enter{from{opacity:.35;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}",
      "@media (prefers-reduced-motion:reduce){.wall-enter{animation:none!important}}",
      "</style>",
    );
  }
  elements.push(
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="${palette.background}" stroke="${palette.grid}" stroke-width="1" rx="${cardRadius}"/>`,
    `<rect width="${width}" height="${Math.round(height / 2)}" fill="url(#wall-surface-glow)" rx="${cardRadius}"/>`,
  );

  // Editorial header: a data glyph and a single hairline establish hierarchy.
  elements.push(
    `<text x="${padding}" y="${padding - 8 + headerOffset}" fill="${palette.muted}" font-family="${FONT}" font-size="10" font-weight="600" letter-spacing="1.7">REPOSITORY PEOPLE · ${escapeXml(repository)}</text>`,
    `<g transform="translate(${padding} ${padding + 4 + headerOffset})" fill="url(#wall-accent)" aria-hidden="true"><circle cx="5" cy="5" r="3.5"/><circle cx="17" cy="5" r="3.5"/><circle cx="11" cy="15" r="3.5"/></g>`,
    `<text x="${padding + 30}" y="${padding + 25 + headerOffset}" fill="${palette.foreground}" font-family="${FONT}" font-size="24" font-weight="700" letter-spacing="-0.4">${escapeXml(title)}</text>`,
    `<text x="${width - padding}" y="${padding + 23 + headerOffset}" fill="${palette.foreground}" font-family="${FONT}" font-size="22" font-weight="700" letter-spacing="-0.4" text-anchor="end">${countLabel}</text>`,
    `<line x1="${padding}" y1="${padding + 61 + headerOffset}" x2="${width - padding}" y2="${padding + 61 + headerOffset}" stroke="${palette.grid}" stroke-width="1"/>`,
  );
  elements.push(`<g${wallClass}>`);

  if (contributors.length === 0) {
    elements.push(
      `<text x="${width / 2}" y="${gridTop + 36}" fill="${palette.muted}" font-family="${FONT}" font-size="16" text-anchor="middle">No contributors yet</text>`,
    );
  } else {
    const center = avatarSize / 2;
    const fontSize = Math.max(11, Math.round(avatarSize * 0.34));
    for (const [index, contributor] of contributors.entries()) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = padding + column * (avatarSize + gap);
      const y = gridTop + row * (avatarSize + gap);
      const login = escapeXml(contributor.login);
      const initial = escapeXml(contributor.login.slice(0, 1).toUpperCase() || "?");
      const contributionLabel = `${contributor.contributions} ${contributor.contributions === 1 ? "contribution" : "contributions"}`;
      const topThree = index < 3;
      elements.push(
        `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">`,
        `<title>#${index + 1} ${login}, ${contributionLabel}</title>`,
        `<rect width="${avatarSize}" height="${avatarSize}" rx="${radius}" fill="url(#wall-accent)" opacity="0.18"/>`,
      );
      if (contributor.avatarDataUrl && AVATAR_DATA_URL.test(contributor.avatarDataUrl)) {
        elements.push(
          `<image width="${avatarSize}" height="${avatarSize}" href="${contributor.avatarDataUrl}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-clip)"/>`,
        );
      } else {
        elements.push(
          `<text x="${center}" y="${center + fontSize / 3}" fill="${palette.foreground}" font-family="${FONT}" font-size="${fontSize}" font-weight="600" text-anchor="middle">${initial}</text>`,
        );
      }
      if (topThree) {
        elements.push(
          `<rect x="0.75" y="0.75" width="${avatarSize - 1.5}" height="${avatarSize - 1.5}" rx="${Math.max(0, radius - 0.75)}" fill="none" stroke="url(#wall-accent)" stroke-width="2"/>`,
        );
      } else {
        elements.push(
          `<rect x="0.5" y="0.5" width="${avatarSize - 1}" height="${avatarSize - 1}" rx="${Math.max(0, radius - 0.5)}" fill="none" stroke="${palette.grid}"/>`,
        );
      }
      elements.push("</g>");
    }
  }
  elements.push("</g>", "</svg>");
  return `${elements.join("\n")}\n`;
}
