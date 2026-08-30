# Repository Visuals Design System

## 1. Atmosphere & Identity

A precise developer-facing data graphic that stays readable inside a GitHub README. The signature is an editorial observation line: a restrained trend, sparse dots sampled from the real history, one small data glyph, and disciplined utility labels. The composition borrows the clarity and pacing of print data graphics while keeping the current total immediately scannable.

## 2. Color

### Themes

Nine themes each ship a tuned light and dark palette built from the same six roles — `background`, `foreground`, `muted`, `grid`, and a `start`/`end` accent pair that forms the trend gradient. Warm-to-cool families cover most README aesthetics:

| Theme | Default variant | Accent (light → dark direction) |
| --- | --- | --- |
| `classic` | area | Warm paper + vermilion |
| `minimal` | line | Crisp blue |
| `gradient` | glow | Emerald → sky |
| `midnight` | glow | Indigo → violet |
| `sunset` | glow | Amber → rose |
| `ocean` | area | Cyan → sky |
| `forest` | area | Lime → green |
| `flame` | glow | Orange → red |
| `mono` | line | Warm paper + monochrome ink |

The `background-color`, `background-color-dark`, `accent-color`, and `accent-color-dark` inputs override individual roles on top of any theme; an accent override collapses the gradient to a single validated hex color. Color never carries data meaning by itself: every theme renders the same line, endpoint marker, header total, axes, and textual summary. Area fills remain subordinate to the trend line.

## 3. Typography

| Role | Size | Weight | Usage |
| --- | --- | --- | --- |
| Current total | 30px | 700 | Latest star count in the header |
| Title | 24–25px | 700 | Chart and contributor-wall names |
| Metadata | 13px | 400 | Repository and axis labels |
| Utility | 10px | 600 | Eyebrows, total label, and footer captions |

The SVG uses a self-contained system sans-serif stack. It never downloads fonts or external assets, preserving deterministic rendering and privacy.

## 4. Spacing & Layout

The base unit is 4px. Star charts share a 960px-wide canvas and offer three compositions: `editorial` (`960 × 540`) balances context and detail, `glance` (`960 × 500`) makes the current count dominant and removes y-axis labels, and `compact` (`960 × 400`) reduces header, tick, and footer density for tighter README placement. Layout is independent from theme and chart variant. Contributor walls use an 82px header above a dynamic grid whose width follows the configured column count, avatar size, gap, and outer padding (defaults: 16 columns, 48px avatars, 8px gap, 32px padding). Both scale responsively without layout-dependent JavaScript, and every card carries a 1px hairline border so it reads as a distinct surface against any README background.

## 5. Components

### Star History Chart

- **Structure**: accessible SVG title and description, bordered surface, editorial eyebrow, sparkle data glyph, title, repository, right-aligned current total, hairline divider, mixed grid, trend group, haloed endpoint marker, and utility footer.
- **Layouts**: `editorial` keeps the full information hierarchy, `glance` prioritizes the current count for quick scanning, and `compact` shortens the canvas while retaining readable axes. `chart-layout` selects the composition.
- **Observation rhythm**: long histories sample at most 31 intermediate dots while preserving the complete line path. The dots make the source records legible without turning a daily history into noise.
- **Variants**: `area` (filled), `line` (stroke only), and `glow` (area plus a soft static bloom). Each theme selects a default variant, and `chart-variant` overrides it independently of the palette.
- **Line shape**: `smooth` (default) draws a Fritsch–Carlson monotone cubic spline that never overshoots the data, so a cumulative star line stays monotonic; disabling it falls back to straight segments.
- **States**: one-point history, multi-point history, static motion-disabled, animated reveal. Invalid or empty history fails before rendering.
- **Accessibility**: `role="img"`, linked `<title>` and `<desc>`, readable text contrast, a visible endpoint marker, and reduced-motion support. The current total is real text, not a decorative label.
- **Motion**: one entry reveal on the trend group, one endpoint emphasis, and a slow endpoint halo pulse that is suppressed under reduced-motion. No looping geometry animation.

### Contributor Wall

- **Structure**: accessible SVG title and description, bordered surface, top utility repository label, three-dot data glyph, right-aligned contributor count, hairline divider, and a dense avatar grid.
- **Layout**: column count, avatar size, gap, outer padding, and avatar shape (`circle`, `squircle`, `square`) are all configurable; the viewBox is computed from them.
- **Leaderboard**: contributors are ordered by contribution count, the top three carry an accent ring, and each avatar exposes its rank and count through a per-avatar `<title>`.
- **Theme**: the same nine themes and color overrides as the chart, each with light and dark output.
- **States**: populated wall, empty repository, missing avatar fallback, static motion-disabled, animated reveal.
- **Privacy and reliability**: GitHub avatars are resized before generation and embedded as validated raster data URLs; rendered SVG files make no external requests. Only `data:` image URLs matching a raster allowlist are emitted.
- **Motion**: the complete wall enters once as a group. Individual avatars never loop or stagger.

## 6. Motion & Interaction

- Entry duration: 520ms with `cubic-bezier(0.16, 1, 0.3, 1)` on the trend group and contributor wall.
- Endpoint emphasis: a 320ms scale-in after a short delay, plus an optional 2.6s halo pulse.
- Only `transform` and `opacity` animate; SVG geometry never triggers layout work.
- `prefers-reduced-motion: reduce` disables all motion and hides the halo pulse while keeping the complete chart visible.
- Motion is optional through the Action's `animate` input.

## 7. Depth & Surface

Depth uses tonal shifts, a hairline card border, and translucent fills rather than heavy shadows. `area` themes remain warm and familiar, `line` themes remove the fill, and `glow` themes keep one subdued bloom. Vertical hairlines and quiet dashed horizontal rules give the chart an editorial plotting field without obscuring the trend.
