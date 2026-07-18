import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateStargazers,
  mergeSnapshot,
  validateHistory,
  type StarHistory,
} from "../src/history.ts";

const history = (): StarHistory => ({
  schema: 1,
  repository: "rustfs/rustfs",
  points: [
    ["2024-05-06", 1],
    ["2026-07-18", 29_944],
  ],
});

test("aggregates stargazers by UTC day", () => {
  assert.deepEqual(
    aggregateStargazers([
      "2024-05-07T08:00:00Z",
      "2024-05-06T14:14:07Z",
      "2024-05-07T09:00:00+00:00",
    ]),
    [
      ["2024-05-06", 1],
      ["2024-05-07", 3],
    ],
  );
});

test("replaces the same UTC day and allows star decreases", () => {
  assert.deepEqual(mergeSnapshot(history(), "2026-07-18", 29_900).points.at(-1), [
    "2026-07-18",
    29_900,
  ]);
});

test("starts an empty history at the snapshot", () => {
  const empty: StarHistory = { schema: 1, repository: "rustfs/rustfs", points: [] };
  assert.deepEqual(mergeSnapshot(empty, "2026-07-18", 0).points, [["2026-07-18", 0]]);
});

test("rejects an older snapshot", () => {
  assert.throws(() => mergeSnapshot(history(), "2026-07-17", 29_900), /older/);
});

test("rejects corrupt or mismatched persisted history", () => {
  const corrupt = history();
  corrupt.points.reverse();
  assert.throws(() => validateHistory(corrupt, "rustfs/rustfs"), /strictly increasing/);
  assert.throws(() => validateHistory(history(), "other/repo"), /belongs to/);
});
