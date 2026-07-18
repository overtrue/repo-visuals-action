import { paletteFor, type ChartStyle } from "./theme.ts";

export const DEFAULT_CONTRIBUTORS_LIMIT = 150;
export const MAX_CONTRIBUTORS_LIMIT = 200;

export interface Contributor {
  login: string;
  contributions: number;
  avatarDataUrl: string | null;
}

export interface ContributorSvgOptions {
  dark?: boolean;
  style?: ChartStyle;
  animate?: boolean;
}

const AVATAR_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

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

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderContributorsSvg(
  contributors: Contributor[],
  repository: string,
  options: ContributorSvgOptions = {},
): string {
  const dark = options.dark ?? false;
  const style = options.style ?? "classic";
  const animate = options.animate ?? true;
  const palette = paletteFor(style, dark);
  const width = 960;
  const left = 32;
  const right = 32;
  const top = 80;
  const bottom = 32;
  const avatarSize = 48;
  const gap = 8;
  const columns = 16;
  const rows = Math.max(1, Math.ceil(contributors.length / columns));
  const gridHeight = contributors.length === 0 ? 80 : rows * avatarSize + (rows - 1) * gap;
  const height = top + gridHeight + bottom;
  const font = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const countLabel = `${contributors.length} ${contributors.length === 1 ? "contributor" : "contributors"}`;
  const topContributors = contributors.slice(0, 10).map(({ login }) => login).join(", ");
  const description = contributors.length === 0
    ? `No contributors found for ${repository}.`
    : `${countLabel} for ${repository}. Top contributors: ${topContributors}.`;
  const wallClass = animate ? ' class="wall-enter"' : "";
  const elements = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description" data-style="${style}" data-animated="${animate}">`,
    `<title id="title">${escapeXml(repository)} contributors</title>`,
    `<desc id="description">${escapeXml(description)}</desc>`,
    "<defs>",
    `<linearGradient id="wall-accent" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${palette.start}"/><stop offset="100%" stop-color="${palette.end}"/></linearGradient>`,
    `<clipPath id="avatar-clip"><circle cx="24" cy="24" r="24"/></clipPath>`,
  ];
  if (style === "gradient") {
    elements.push(
      `<radialGradient id="wall-surface-glow" cx="76%" cy="12%" r="72%"><stop offset="0%" stop-color="${palette.end}" stop-opacity="0.12"/><stop offset="100%" stop-color="${palette.background}" stop-opacity="0"/></radialGradient>`,
    );
  }
  elements.push("</defs>");
  if (animate) {
    elements.push(
      "<style>",
      ".wall-enter{transform-box:fill-box;transform-origin:center;animation:wall-enter 480ms cubic-bezier(0.16,1,0.3,1)}",
      "@keyframes wall-enter{from{opacity:.4;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}",
      "@media (prefers-reduced-motion:reduce){.wall-enter{animation:none!important}}",
      "</style>",
    );
  }
  elements.push(
    `<rect width="${width}" height="${height}" fill="${palette.background}" rx="${style === "gradient" ? 16 : 12}"/>`,
  );
  if (style === "gradient") {
    elements.push(`<rect width="${width}" height="${height}" fill="url(#wall-surface-glow)" rx="16"/>`);
  }
  elements.push(
    `<g transform="translate(${left} 18)" fill="none" stroke="url(#wall-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></g>`,
    `<text x="${left + 36}" y="40" fill="${palette.foreground}" font-family="${font}" font-size="24" font-weight="600">Contributors</text>`,
    `<text x="${left + 36}" y="62" fill="${palette.muted}" font-family="${font}" font-size="14">${escapeXml(repository)}</text>`,
    `<text x="${width - right}" y="40" fill="${palette.muted}" font-family="${font}" font-size="14" font-weight="500" text-anchor="end">${countLabel}</text>`,
    `<g${wallClass}>`,
  );

  if (contributors.length === 0) {
    elements.push(
      `<text x="${width / 2}" y="${top + 36}" fill="${palette.muted}" font-family="${font}" font-size="16" text-anchor="middle">No contributors yet</text>`,
    );
  } else {
    for (const [index, contributor] of contributors.entries()) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = left + column * (avatarSize + gap);
      const y = top + row * (avatarSize + gap);
      const login = escapeXml(contributor.login);
      const initial = escapeXml(contributor.login.slice(0, 1).toUpperCase() || "?");
      const contributionLabel = `${contributor.contributions} ${contributor.contributions === 1 ? "contribution" : "contributions"}`;
      elements.push(
        `<g transform="translate(${x} ${y})">`,
        `<title>${login}, ${contributionLabel}</title>`,
        `<circle cx="24" cy="24" r="24" fill="url(#wall-accent)" opacity="0.20"/>`,
      );
      if (contributor.avatarDataUrl && AVATAR_DATA_URL.test(contributor.avatarDataUrl)) {
        elements.push(
          `<image width="48" height="48" href="${contributor.avatarDataUrl}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-clip)"/>`,
        );
      } else {
        elements.push(
          `<text x="24" y="30" fill="${palette.foreground}" font-family="${font}" font-size="16" font-weight="600" text-anchor="middle">${initial}</text>`,
        );
      }
      elements.push(
        `<circle cx="24" cy="24" r="23.5" fill="none" stroke="${palette.grid}"/>`,
        "</g>",
      );
    }
  }
  elements.push("</g>", "</svg>");
  return `${elements.join("\n")}\n`;
}
