import assert from "node:assert/strict";
import test from "node:test";

import { renderSvg, formatCount } from "../src/svg.ts";

const history = {
  schema: 1,
  repository: "rustfs/rustfs",
  points: [
    ["2024-05-06", 1],
    ["2026-07-18", 29_944],
  ] as [string, number][],
};

test("renders accessible light and dark SVG charts", () => {
  const light = renderSvg(history);
  const dark = renderSvg(history, true);
  assert.match(light, /^<\?xml/);
  assert.match(light, /aria-labelledby="title description"/);
  assert.match(light, />29\.9K<\/text>/);
  assert.doesNotMatch(light, /<script/i);
  assert.notEqual(light, dark);
});

test("formats chart counts", () => {
  assert.equal(formatCount(999), "999");
  assert.equal(formatCount(29_944), "29.9K");
  assert.equal(formatCount(1_500_000), "1.5M");
});
