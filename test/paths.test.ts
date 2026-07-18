import assert from "node:assert/strict";
import test from "node:test";

import { outputFile, rawUrl, validateBranch, validateOutputPath } from "../src/paths.ts";

test("normalizes root and nested output paths", () => {
  assert.equal(validateOutputPath("."), "");
  assert.equal(validateOutputPath("assets/stars"), "assets/stars");
  assert.equal(outputFile("assets/stars", "chart.svg"), "assets/stars/chart.svg");
});

test("rejects traversal and git metadata output paths", () => {
  for (const path of ["../assets", "/assets", "assets\\stars", "assets//stars", ".git/charts"]) {
    assert.throws(() => validateOutputPath(path), /output-path/);
  }
});

test("validates output branches", () => {
  assert.equal(validateBranch("star-history"), "star-history");
  for (const branch of ["../main", "refs//heads", "feature@{one", "name.lock"]) {
    assert.throws(() => validateBranch(branch), /output-branch/);
  }
});

test("builds raw URLs for nested output paths", () => {
  assert.equal(
    rawUrl("https://github.com", "rustfs/rustfs", "star-history", "assets/stars/light.svg"),
    "https://raw.githubusercontent.com/rustfs/rustfs/refs/heads/star-history/assets/stars/light.svg",
  );
});
