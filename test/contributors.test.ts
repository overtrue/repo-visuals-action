import assert from "node:assert/strict";
import test from "node:test";

import {
  renderContributorsSvg,
  validateAvatarGap,
  validateAvatarShape,
  validateAvatarSize,
  validateContributorsColumns,
  validateContributorsLimit,
  validatePadding,
  type Contributor,
} from "../src/contributors.ts";
import { CHART_STYLES } from "../src/svg.ts";

const avatarDataUrl = `data:image/png;base64,${Buffer.from("avatar").toString("base64")}`;
const contributors: Contributor[] = [
  { login: "overtrue", contributions: 1516, avatarDataUrl },
  { login: "houseme", contributions: 882, avatarDataUrl: null },
];

test("renders an accessible self-contained contributor wall", () => {
  const light = renderContributorsSvg(contributors, "rustfs/rustfs", { style: "gradient" });
  const dark = renderContributorsSvg(contributors, "rustfs/rustfs", { dark: true, style: "gradient" });

  assert.match(light, /^<\?xml/);
  assert.match(light, /aria-labelledby="title description"/);
  assert.match(light, /2 contributors/);
  assert.match(light, /overtrue, 1516 contributions/);
  assert.match(light, /data:image\/png;base64/);
  assert.match(light, />H<\/text>/);
  assert.match(light, /prefers-reduced-motion/);
  assert.doesNotMatch(light, /(?:href|src)="https?:\/\//);
  assert.doesNotMatch(light, /<script/i);
  assert.notEqual(light, dark);
});

test("renders empty and static contributor states", () => {
  const svg = renderContributorsSvg([], "rustfs/rustfs", { animate: false });

  assert.match(svg, /No contributors yet/);
  assert.match(svg, /data-animated="false"/);
  assert.doesNotMatch(svg, /<style>/);
});

test("renders every contributor style in light and dark", () => {
  const light = CHART_STYLES.map((style) =>
    renderContributorsSvg(contributors, "rustfs/rustfs", { style, animate: false }),
  );
  for (const [index, style] of CHART_STYLES.entries()) {
    const dark = renderContributorsSvg(contributors, "rustfs/rustfs", {
      dark: true,
      style,
      animate: false,
    });
    assert.match(light[index] ?? "", new RegExp(`data-style="${style}"`));
    assert.notEqual(light[index], dark);
  }
  assert.equal(new Set(light).size, CHART_STYLES.length);
});

test("escapes contributor metadata and rejects unsafe avatar data", () => {
  const svg = renderContributorsSvg(
    [{ login: '<script>&"', contributions: 1, avatarDataUrl: "data:image/svg+xml;base64,PHN2Zy8+" }],
    "owner/repository",
    { animate: false },
  );

  assert.match(svg, /&lt;script&gt;&amp;&quot;/);
  assert.doesNotMatch(svg, /data:image\/svg\+xml/);
  assert.doesNotMatch(svg, /<script>/);
});

test("applies avatar layout, shape, title, and color overrides", () => {
  const svg = renderContributorsSvg(contributors, "rustfs/rustfs", {
    animate: false,
    title: "Our Team",
    layout: { avatarSize: 64, gap: 12, columns: 8, padding: 40, shape: "squircle" },
    overrides: { background: "#101828" },
  });

  assert.match(svg, /data-shape="squircle"/);
  assert.match(svg, /viewBox="0 0 676 \d+"/); // 40*2 + 8*64 + 7*12 = 676
  assert.match(svg, /<image width="64" height="64"/);
  assert.match(svg, /rx="19"/); // squircle radius = round(64 * 0.3)
  assert.match(svg, />Our Team<\/text>/);
  assert.match(svg, /fill="#101828"/);
});

test("keeps the editorial header visible at minimum padding", () => {
  const svg = renderContributorsSvg(contributors, "rustfs/rustfs", {
    animate: false,
    layout: { padding: 8 },
  });

  assert.match(svg, /<text x="8" y="14"[^>]*>REPOSITORY PEOPLE/);
});

test("highlights the leading contributors", () => {
  const svg = renderContributorsSvg(contributors, "rustfs/rustfs", { animate: false });

  assert.match(svg, /Led by overtrue/);
  assert.match(svg, /#1 overtrue, 1516 contributions/);
  assert.match(svg, /stroke="url\(#wall-accent\)" stroke-width="2"/);
  assert.match(svg, />1<\/text>/);
  assert.match(svg, />2<\/text>/);
});

test("validates contributor limits and layout inputs", () => {
  assert.equal(validateContributorsLimit("1"), 1);
  assert.equal(validateContributorsLimit("150"), 150);
  assert.equal(validateContributorsLimit("200"), 200);
  assert.throws(() => validateContributorsLimit("0"), /between 1 and 200/);
  assert.throws(() => validateContributorsLimit("201"), /between 1 and 200/);
  assert.throws(() => validateContributorsLimit("1.5"), /integer/);

  assert.equal(validateAvatarSize("64"), 64);
  assert.throws(() => validateAvatarSize("16"), /between 24 and 128/);
  assert.equal(validateAvatarGap("0"), 0);
  assert.throws(() => validateAvatarGap("100"), /between 0 and 48/);
  assert.equal(validateContributorsColumns("12"), 12);
  assert.throws(() => validateContributorsColumns("40"), /between 4 and 32/);
  assert.equal(validatePadding("40"), 40);
  assert.throws(() => validatePadding("4"), /between 8 and 96/);
  assert.equal(validateAvatarShape("squircle"), "squircle");
  assert.throws(() => validateAvatarShape("hexagon"), /circle, squircle, square/);
});
