export const CHART_VARIANTS = ["area", "line", "glow"] as const;
export type ChartVariant = (typeof CHART_VARIANTS)[number];

export interface Palette {
  background: string;
  foreground: string;
  muted: string;
  grid: string;
  start: string;
  end: string;
}

export interface Theme {
  light: Palette;
  dark: Palette;
  variant: ChartVariant;
}

const THEMES = {
  classic: {
    variant: "area",
    light: {
      background: "#f5f4f0",
      foreground: "#1c1c1a",
      muted: "#74716a",
      grid: "#dedbd3",
      start: "#f0522d",
      end: "#f0522d",
    },
    dark: {
      background: "#1b1b19",
      foreground: "#f5f4f0",
      muted: "#aaa69c",
      grid: "#393833",
      start: "#ff6b45",
      end: "#ff6b45",
    },
  },
  minimal: {
    variant: "line",
    light: {
      background: "#ffffff",
      foreground: "#24292f",
      muted: "#57606a",
      grid: "#d8dee4",
      start: "#2563eb",
      end: "#2563eb",
    },
    dark: {
      background: "#0d1117",
      foreground: "#e6edf3",
      muted: "#8b949e",
      grid: "#30363d",
      start: "#60a5fa",
      end: "#60a5fa",
    },
  },
  gradient: {
    variant: "glow",
    light: {
      background: "#f8fafc",
      foreground: "#172033",
      muted: "#526072",
      grid: "#dbe4ee",
      start: "#059669",
      end: "#0284c7",
    },
    dark: {
      background: "#0f172a",
      foreground: "#f8fafc",
      muted: "#94a3b8",
      grid: "#27364a",
      start: "#3ecf8e",
      end: "#38bdf8",
    },
  },
  midnight: {
    variant: "glow",
    light: {
      background: "#f5f3ff",
      foreground: "#1e1b4b",
      muted: "#6d68a3",
      grid: "#e6e1fb",
      start: "#6366f1",
      end: "#a855f7",
    },
    dark: {
      background: "#0b0a1f",
      foreground: "#ede9fe",
      muted: "#a29ccc",
      grid: "#241f45",
      start: "#818cf8",
      end: "#c084fc",
    },
  },
  sunset: {
    variant: "glow",
    light: {
      background: "#fff7ed",
      foreground: "#431407",
      muted: "#9a6a4f",
      grid: "#fbe2cc",
      start: "#f59e0b",
      end: "#ec4899",
    },
    dark: {
      background: "#1b0f0a",
      foreground: "#ffedd5",
      muted: "#cb9d88",
      grid: "#3d2418",
      start: "#fbbf24",
      end: "#f472b6",
    },
  },
  ocean: {
    variant: "area",
    light: {
      background: "#f0fdfa",
      foreground: "#042f2e",
      muted: "#4a7d78",
      grid: "#c8ede8",
      start: "#06b6d4",
      end: "#0ea5e9",
    },
    dark: {
      background: "#04141a",
      foreground: "#ccfbf1",
      muted: "#7fb8b5",
      grid: "#123038",
      start: "#22d3ee",
      end: "#38bdf8",
    },
  },
  forest: {
    variant: "area",
    light: {
      background: "#f7fee7",
      foreground: "#14320a",
      muted: "#5c7a44",
      grid: "#dcefc4",
      start: "#65a30d",
      end: "#16a34a",
    },
    dark: {
      background: "#08160a",
      foreground: "#ecfccb",
      muted: "#8bab73",
      grid: "#1a2e15",
      start: "#a3e635",
      end: "#4ade80",
    },
  },
  flame: {
    variant: "glow",
    light: {
      background: "#fff7ed",
      foreground: "#431407",
      muted: "#9a6a4f",
      grid: "#fbdcc9",
      start: "#fb923c",
      end: "#ef4444",
    },
    dark: {
      background: "#170a04",
      foreground: "#ffe4d5",
      muted: "#c99a86",
      grid: "#3a1a0e",
      start: "#fdba74",
      end: "#f87171",
    },
  },
  mono: {
    variant: "line",
    light: {
      background: "#f5f4f0",
      foreground: "#1c1c1a",
      muted: "#74716a",
      grid: "#dedbd3",
      start: "#696762",
      end: "#1c1c1a",
    },
    dark: {
      background: "#1b1b19",
      foreground: "#f5f4f0",
      muted: "#aaa69c",
      grid: "#393833",
      start: "#b8b4aa",
      end: "#f5f4f0",
    },
  },
} as const satisfies Record<string, Theme>;

export type ChartStyle = keyof typeof THEMES;
export const CHART_STYLES = Object.keys(THEMES) as ChartStyle[];

export interface PaletteOverrides {
  background?: string;
  backgroundDark?: string;
  accent?: string;
  accentDark?: string;
}

export function themeFor(style: ChartStyle): Theme {
  return THEMES[style];
}

export function paletteFor(style: ChartStyle, dark: boolean): Palette {
  return dark ? THEMES[style].dark : THEMES[style].light;
}

export function resolvePalette(style: ChartStyle, dark: boolean, overrides: PaletteOverrides = {}): Palette {
  const base = paletteFor(style, dark);
  const background = dark ? overrides.backgroundDark : overrides.background;
  const accent = dark ? overrides.accentDark : overrides.accent;
  return {
    ...base,
    ...(background ? { background } : {}),
    ...(accent ? { start: accent, end: accent } : {}),
  };
}

export function validateChartStyle(value: string): ChartStyle {
  if ((CHART_STYLES as readonly string[]).includes(value)) {
    return value as ChartStyle;
  }
  throw new Error(`chart-style must be one of: ${CHART_STYLES.join(", ")}`);
}

export function validateChartVariant(value: string): ChartVariant {
  if ((CHART_VARIANTS as readonly string[]).includes(value)) {
    return value as ChartVariant;
  }
  throw new Error(`chart-variant must be one of: ${CHART_VARIANTS.join(", ")}`);
}

const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function validateColor(value: string, label: string): string {
  const color = value.trim();
  if (!COLOR_PATTERN.test(color)) {
    throw new Error(`${label} must be a hex color such as #0d1117`);
  }
  return color;
}
