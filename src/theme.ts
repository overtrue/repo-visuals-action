export const CHART_STYLES = ["classic", "minimal", "gradient"] as const;
export type ChartStyle = (typeof CHART_STYLES)[number];

export interface Palette {
  background: string;
  foreground: string;
  muted: string;
  grid: string;
  start: string;
  end: string;
}

const PALETTES: Record<ChartStyle, { light: Palette; dark: Palette }> = {
  classic: {
    light: {
      background: "#ffffff",
      foreground: "#24292f",
      muted: "#57606a",
      grid: "#d8dee4",
      start: "#d84a3a",
      end: "#d84a3a",
    },
    dark: {
      background: "#0d1117",
      foreground: "#e6edf3",
      muted: "#8b949e",
      grid: "#30363d",
      start: "#e05d44",
      end: "#e05d44",
    },
  },
  minimal: {
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
};

export function paletteFor(style: ChartStyle, dark: boolean): Palette {
  return PALETTES[style][dark ? "dark" : "light"];
}

export function validateChartStyle(value: string): ChartStyle {
  if ((CHART_STYLES as readonly string[]).includes(value)) {
    return value as ChartStyle;
  }
  throw new Error(`chart-style must be one of: ${CHART_STYLES.join(", ")}`);
}
