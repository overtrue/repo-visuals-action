import assert from "node:assert/strict";
import test from "node:test";

import {
  CHART_STYLES,
  formatCount,
  renderSvg,
  validateChartStyle,
} from "../src/svg.ts";

const history = {
  schema: 1,
  repository: "rustfs/rustfs",
  points: [
    ["2024-05-06", 1],
    ["2026-07-18", 29_944],
  ] as [string, number][],
};

test("renders every chart style in accessible light and dark SVG", () => {
  for (const style of CHART_STYLES) {
    const light = renderSvg(history, { style });
    const dark = renderSvg(history, { dark: true, style });
    assert.match(light, /^<\?xml/);
    assert.match(light, /aria-labelledby="title description"/);
    assert.match(light, new RegExp(`data-style="${style}"`));
    assert.match(light, />29\.9K<\/text>/);
    assert.match(light, /prefers-reduced-motion/);
    assert.doesNotMatch(light, /<script/i);
    assert.notEqual(light, dark);
  }
});

test("keeps style differences explicit", () => {
  const classic = renderSvg(history, { style: "classic", animate: false });
  const minimal = renderSvg(history, { style: "minimal", animate: false });
  const gradient = renderSvg(history, { style: "gradient", animate: false });

  assert.match(classic, /<path d="[^\n]+" fill="url\(#area\)"\/>/);
  assert.doesNotMatch(minimal, /id="area"/);
  assert.doesNotMatch(minimal, /fill="url\(#area\)"\/>/);
  assert.match(gradient, /id="surface-glow"/);
  assert.match(gradient, /id="trend-glow"/);
  assert.doesNotMatch(gradient, /<style>/);
  assert.match(gradient, /data-animated="false"/);
});

test("places a one-point history at the current edge", () => {
  const svg = renderSvg(
    { ...history, points: [["2026-07-18", 0]] },
    { style: "minimal", animate: false },
  );

  assert.match(svg, /cx="928\.0"/);
});

test("validates chart styles", () => {
  assert.equal(validateChartStyle("gradient"), "gradient");
  assert.throws(() => validateChartStyle("neon"), /classic, minimal, gradient/);
});

test("formats chart counts", () => {
  assert.equal(formatCount(999), "999");
  assert.equal(formatCount(29_944), "29.9K");
  assert.equal(formatCount(1_500_000), "1.5M");
});
