import assert from "node:assert/strict";
import test from "node:test";

import {
  CHART_STYLES,
  CHART_VARIANTS,
  formatCount,
  renderSvg,
  validateChartStyle,
  validateChartVariant,
  validateColor,
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
    assert.match(light, />29,944<\/text>/);
    assert.match(light, /prefers-reduced-motion/);
    assert.doesNotMatch(light, /<script/i);
    assert.notEqual(light, dark);
  }
});

test("keeps variant differences explicit", () => {
  const classic = renderSvg(history, { style: "classic", animate: false });
  const minimal = renderSvg(history, { style: "minimal", animate: false });
  const gradient = renderSvg(history, { style: "gradient", animate: false });

  assert.match(classic, /data-variant="area"/);
  assert.match(classic, /<path d="[^\n]+" fill="url\(#area\)"\/>/);
  assert.match(minimal, /data-variant="line"/);
  assert.doesNotMatch(minimal, /id="area"/);
  assert.doesNotMatch(minimal, /fill="url\(#area\)"\/>/);
  assert.match(gradient, /data-variant="glow"/);
  assert.match(gradient, /id="surface-glow"/);
  assert.match(gradient, /id="trend-glow"/);
  assert.doesNotMatch(gradient, /<style>/);
  assert.match(gradient, /data-animated="false"/);
});

test("overrides a theme variant without changing its palette", () => {
  const areaLine = renderSvg(history, { style: "classic", variant: "line", animate: false });
  assert.match(areaLine, /data-variant="line"/);
  assert.doesNotMatch(areaLine, /fill="url\(#area\)"\/>/);
});

test("smooths the trend line by default and can disable it", () => {
  const dense = {
    schema: 1,
    repository: "rustfs/rustfs",
    points: [
      ["2024-05-06", 1],
      ["2025-01-01", 4_000],
      ["2025-08-01", 12_000],
      ["2026-07-18", 29_944],
    ] as [string, number][],
  };
  const smooth = renderSvg(dense, { style: "minimal", animate: false });
  const straight = renderSvg(dense, { style: "minimal", animate: false, smooth: false });

  assert.match(smooth, /d="M [\d.]+ [\d.]+ C /);
  assert.doesNotMatch(straight, / C /);
  assert.match(straight, /d="M [\d.]+ [\d.]+ L /);
});

test("adds a bounded set of editorial observation dots", () => {
  const points = Array.from({ length: 100 }, (_, index) => [
    new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    index,
  ]) as [string, number][];
  const svg = renderSvg({ ...history, points }, { animate: false });

  assert.match(svg, /data-point-count="31"/);
  assert.equal((svg.match(/r="1\.8"/g) ?? []).length, 31);
});

test("applies palette and title overrides", () => {
  const svg = renderSvg(history, {
    style: "classic",
    animate: false,
    title: "GitHub Stars",
    overrides: { background: "#101828", accent: "#ff6600" },
  });

  assert.match(svg, /fill="#101828"/);
  assert.match(svg, /stop-color="#ff6600"/);
  assert.match(svg, />GitHub Stars<\/text>/);
});

test("places a one-point history at the current edge", () => {
  const svg = renderSvg(
    { ...history, points: [["2026-07-18", 0]] },
    { style: "minimal", animate: false },
  );

  assert.match(svg, /cx="920\.0"/);
});

test("validates chart styles, variants, and colors", () => {
  assert.equal(validateChartStyle("gradient"), "gradient");
  assert.throws(() => validateChartStyle("neon"), /classic, minimal, gradient/);
  assert.deepEqual([...CHART_VARIANTS], ["area", "line", "glow"]);
  assert.equal(validateChartVariant("glow"), "glow");
  assert.throws(() => validateChartVariant("bars"), /area, line, glow/);
  assert.equal(validateColor("#0d1117", "background-color"), "#0d1117");
  assert.throws(() => validateColor("red", "accent-color"), /hex color/);
  assert.throws(() => validateColor('#fff"/><script', "accent-color"), /hex color/);
});

test("formats chart counts", () => {
  assert.equal(formatCount(999), "999");
  assert.equal(formatCount(29_944), "29.9K");
  assert.equal(formatCount(1_500_000), "1.5M");
});
