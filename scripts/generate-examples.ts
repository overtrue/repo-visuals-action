// Regenerates the committed example SVGs under assets/examples/rustfs/.
//
// It needs a data directory (EXAMPLES_DATA, default ./.examples-data) holding:
//   - history.json      : a StarHistory document (schema/repository/points)
//   - contributors.json : [{ login, contributions, avatarDataUrl }]
//
// Run with:  EXAMPLES_DATA=/path/to/data npm run examples
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderSvg } from "../src/svg.ts";
import { renderContributorsSvg, type Contributor } from "../src/contributors.ts";
import { CHART_STYLES } from "../src/theme.ts";
import type { StarHistory } from "../src/history.ts";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.EXAMPLES_DATA ?? join(here, "..", ".examples-data");
const outDir = join(here, "..", "assets", "examples", "rustfs");
mkdirSync(outDir, { recursive: true });

const history = JSON.parse(readFileSync(join(dataDir, "history.json"), "utf8")) as StarHistory;
const contributors = JSON.parse(readFileSync(join(dataDir, "contributors.json"), "utf8")) as Contributor[];
const repository = history.repository;

let bytes = 0;
function emit(name: string, content: string): void {
  const file = join(outDir, name);
  writeFileSync(file, content);
  bytes += Buffer.byteLength(content);
  console.log(`  ${name.padEnd(32)} ${(Buffer.byteLength(content) / 1024).toFixed(0)}KB`);
}

// Star history charts: every theme, light + dark, using its default variant.
console.log("star history charts:");
for (const style of CHART_STYLES) {
  emit(`${style}-light.svg`, renderSvg(history, { style }));
  emit(`${style}-dark.svg`, renderSvg(history, { dark: true, style }));
}

// Contributor walls: the primary gradient wall plus a themed/shape showcase.
console.log("contributor walls:");
emit("contributors-light.svg", renderContributorsSvg(contributors, repository, { style: "gradient" }));
emit("contributors-dark.svg", renderContributorsSvg(contributors, repository, { dark: true, style: "gradient" }));

const showcase = contributors.slice(0, 48);
const walls = [
  { style: "midnight", shape: "circle" },
  { style: "sunset", shape: "squircle" },
  { style: "mono", shape: "square" },
] as const;
for (const { style, shape } of walls) {
  const layout = { shape } as const;
  emit(`contributors-${style}-light.svg`, renderContributorsSvg(showcase, repository, { style, layout }));
  emit(`contributors-${style}-dark.svg`, renderContributorsSvg(showcase, repository, { dark: true, style, layout }));
}

console.log(`\ntotal: ${(bytes / 1024 / 1024).toFixed(2)}MB across ${CHART_STYLES.length * 2 + 8} files`);
