# Star History Action Design System

## 1. Atmosphere & Identity

A precise developer-facing data graphic that stays readable inside a GitHub README. The signature is a restrained luminous trend line: the chart feels alive when first revealed, then becomes quiet so the data remains primary. The direction adapts Supabase's code-native dark surfaces and translucent color layering without copying its brand.

## 2. Color

### Palette

| Style | Role | Light | Dark | Usage |
| --- | --- | --- | --- | --- |
| All | Surface | `#ffffff` | `#0d1117` | Classic and minimal canvas |
| All | Text | `#24292f` | `#e6edf3` | Title and primary labels |
| All | Muted text | `#57606a` | `#8b949e` | Repository, axes, timestamp |
| All | Grid | `#d8dee4` | `#30363d` | Low-contrast horizontal guides |
| Classic | Accent | `#d84a3a` | `#e05d44` | Warm star-history line and marker |
| Minimal | Accent | `#2563eb` | `#60a5fa` | Crisp line and marker |
| Gradient | Surface | `#f8fafc` | `#0f172a` | Cool elevated canvas |
| Gradient | Text | `#172033` | `#f8fafc` | Primary labels |
| Gradient | Muted text | `#526072` | `#94a3b8` | Secondary labels |
| Gradient | Grid | `#dbe4ee` | `#27364a` | Guides |
| Gradient | Start | `#059669` | `#3ecf8e` | Trend gradient origin |
| Gradient | End | `#0284c7` | `#38bdf8` | Trend gradient destination |

Color never carries data meaning by itself: all themes render the same line, endpoint marker, count label, axes, and textual summary. Area fills remain subordinate to the trend line.

## 3. Typography

| Role | Size | Weight | Usage |
| --- | --- | --- | --- |
| Title | 24px | 600 | Chart name |
| Current value | 16px | 600 | Latest star count |
| Metadata | 14px | 400 | Repository and date ticks |
| Caption | 12px | 500 | Updated date |

The SVG uses a self-contained system sans-serif stack. It never downloads fonts or external assets, preserving deterministic rendering and privacy.

## 4. Spacing & Layout

The base unit is 4px. The fixed `960 × 540` viewBox scales responsively without layout-dependent JavaScript. Plot margins are 80px left, 32px right, 72px top, and 64px bottom. Text and markers keep at least 8px visual separation.

## 5. Components

### Star History Chart

- **Structure**: accessible SVG title and description, surface, header, axes, trend group, endpoint value, updated caption.
- **Variants**: `classic` area chart, `minimal` line chart, `gradient` luminous area chart; each has light and dark output.
- **States**: one-point history, multi-point history, static motion-disabled, animated reveal. Invalid or empty history fails before rendering.
- **Accessibility**: `role="img"`, linked `<title>` and `<desc>`, readable text contrast, visible endpoint shape and label, reduced-motion support.
- **Motion**: one entry reveal on the trend group and one endpoint emphasis. No looping animation.

## 6. Motion & Interaction

- Entry duration: 480ms with `cubic-bezier(0.16, 1, 0.3, 1)`.
- Endpoint emphasis: 300ms alongside the line entrance.
- Only `transform` and `opacity` animate; SVG geometry never triggers layout work.
- `prefers-reduced-motion: reduce` disables all motion while keeping the complete chart visible.
- Motion is optional through the Action's `animate` input.

## 7. Depth & Surface

Depth uses tonal shifts and translucent fills rather than heavy shadows. Classic is warm and familiar, minimal removes the area fill and decorative depth, and gradient adds one soft static glow behind the trend line. Grid lines stay quiet in every variant so decoration never obscures the trend.
