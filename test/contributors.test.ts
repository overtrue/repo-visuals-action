import assert from "node:assert/strict";
import test from "node:test";

import {
  renderContributorsSvg,
  validateContributorsLimit,
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

test("validates contributor limits", () => {
  assert.equal(validateContributorsLimit("1"), 1);
  assert.equal(validateContributorsLimit("150"), 150);
  assert.equal(validateContributorsLimit("200"), 200);
  assert.throws(() => validateContributorsLimit("0"), /between 1 and 200/);
  assert.throws(() => validateContributorsLimit("201"), /between 1 and 200/);
  assert.throws(() => validateContributorsLimit("1.5"), /integer/);
});
