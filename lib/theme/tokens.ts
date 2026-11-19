/**
 * Design tokens — the single source of truth for colour, gradient, shape,
 * elevation, motion and type.
 *
 * Google's design language (Material 3 / Material You with Google Workspace
 * surfaces and a Gemini-style expressive accent), kept to a 90/10 balance:
 * calm tonal surfaces almost everywhere, expressive colour only for hero
 * headlines, progress and focal accents.
 *
 * `tailwind.config.ts` imports this file and emits every token as a CSS
 * custom property (`--g-*`, plus the HSL channels the Tailwind colour
 * utilities read), so CSS and TypeScript always agree. Contrast is enforced
 * by `scripts/tests/theme.test.ts` (WCAG AA, both modes).
 */

export const THEME_MODES = ["light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const SURFACE_VARIANTS = ["canvas", "surface", "surfaceAlt", "elevated"] as const;
export type SurfaceVariant = (typeof SURFACE_VARIANTS)[number];

export const BUTTON_VARIANTS = ["primary", "tonal", "outlined", "ghost", "danger"] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const ACCENT_TONES = ["neutral", "primary", "success", "warning", "danger"] as const;
export type AccentTone = (typeof ACCENT_TONES)[number];

type Hex = `#${string}`;

export interface Palette {
  canvas: Hex;
  surface: Hex;
  surfaceAlt: Hex;
  elevated: Hex;
  /** Neutral chip fill, one step deeper than `surfaceAlt`. */
  chip: Hex;
  textPrimary: Hex;
  textSecondary: Hex;
  borderSubtle: Hex;
  /** Outline of a text field on hover. */
  borderStrong: Hex;
  primary: Hex;
  primaryHover: Hex;
  onPrimary: Hex;
  primaryContainer: Hex;
  onPrimaryContainer: Hex;
  /** Accent fills (bars, icons, meters). */
  success: Hex;
  warning: Hex;
  danger: Hex;
  /** Readable ink for text in each status colour (AA on every surface). */
  successInk: Hex;
  warningInk: Hex;
  dangerInk: Hex;
  successContainer: Hex;
  warningContainer: Hex;
  dangerContainer: Hex;
  onDanger: Hex;
  /** Chart series: Google blue, green, yellow, red and a Gemini violet. */
  vizBlue: Hex;
  vizGreen: Hex;
  vizYellow: Hex;
  vizRed: Hex;
  vizViolet: Hex;
  vizGrid: Hex;
}

export const PALETTE = {
  light: {
    canvas: "#FFFFFF",
    surface: "#F8F9FA",
    surfaceAlt: "#F1F3F4",
    elevated: "#FFFFFF",
    chip: "#E8EAED",
    textPrimary: "#202124",
    textSecondary: "#5F6368",
    borderSubtle: "#DADCE0",
    borderStrong: "#80868B",
    primary: "#1A73E8",
    primaryHover: "#1557B0",
    onPrimary: "#FFFFFF",
    primaryContainer: "#E8F0FE",
    onPrimaryContainer: "#1967D2",
    success: "#34A853",
    warning: "#FBBC04",
    danger: "#EA4335",
    successInk: "#137333",
    warningInk: "#A05200",
    dangerInk: "#C5221F",
    successContainer: "#E6F4EA",
    warningContainer: "#FEF7E0",
    dangerContainer: "#FCE8E6",
    onDanger: "#FFFFFF",
    vizBlue: "#4285F4",
    vizGreen: "#34A853",
    vizYellow: "#F9AB00",
    vizRed: "#EA4335",
    vizViolet: "#9B72CB",
    vizGrid: "#E8EAED",
  },
  dark: {
    canvas: "#131314",
    surface: "#1E1F20",
    surfaceAlt: "#282A2C",
    elevated: "#282A2C",
    chip: "#333537",
    textPrimary: "#E3E3E3",
    textSecondary: "#C4C7C5",
    borderSubtle: "#444746",
    borderStrong: "#8E918F",
    primary: "#8AB4F8",
    primaryHover: "#A8C7FA",
    onPrimary: "#062E6F",
    primaryContainer: "#004A77",
    onPrimaryContainer: "#C2E7FF",
    success: "#6DD58C",
    warning: "#FDD663",
    danger: "#F28B82",
    successInk: "#6DD58C",
    warningInk: "#FDD663",
    dangerInk: "#F2B8B5",
    successContainer: "#0F5223",
    warningContainer: "#4A3900",
    dangerContainer: "#8C1D18",
    onDanger: "#601410",
    vizBlue: "#8AB4F8",
    vizGreen: "#6DD58C",
    vizYellow: "#FDD663",
    vizRed: "#F28B82",
    vizViolet: "#C58AF9",
    vizGrid: "#3C4043",
  },
} as const satisfies Record<ThemeMode, Palette>;

export const GRADIENTS = {
  /** Gemini-style headline and active-border gradient. */
  expressive: "linear-gradient(135deg, #4285F4 0%, #9B72CB 50%, #D96570 100%)",
  /** Four-colour accent bar and progress fill. */
  google: "linear-gradient(90deg, #4285F4, #34A853, #FBBC04, #EA4335)",
  /** Ambient wash behind a hero area. */
  wash: "radial-gradient(1400px 460px at 20% -10%, rgba(66, 133, 244, 0.08), rgba(155, 114, 203, 0.05) 45%, transparent 75%)",
} as const;

export const ELEVATION = {
  resting: "0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)",
  raised: "0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15)",
} as const;

export const RADII = {
  pill: "9999px",
  field: "12px",
  card: "16px",
  cardLarge: "24px",
  dialog: "28px",
} as const;

export const MOTION = {
  /** Material 3 emphasized easing. */
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  fast: "150ms",
  medium: "200ms",
  slow: "250ms",
  /** State-layer opacities for hover and pressed. */
  hoverLayer: 0.08,
  pressedLayer: 0.12,
} as const;

export const TYPOGRAPHY = {
  display: `"Plus Jakarta Sans", "Inter", "Roboto", system-ui, sans-serif`,
  body: `"Inter", "Roboto", system-ui, -apple-system, "Segoe UI", sans-serif`,
  mono: `ui-monospace, SFMono-Regular, Menlo, "Roboto Mono", monospace`,
} as const;

// ---------------------------------------------------------------- colour maths

/** `#RRGGBB` → `"H S% L%"`, the channel form Tailwind's `hsl(var(--x) / <alpha>)` utilities read. */
export function hexToHslChannels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return `${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

/** WCAG relative luminance of a hex colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------- CSS variables

/**
 * Every CSS custom property for one mode: the `--g-*` design tokens (hex and
 * composite values) and the HSL channels behind the Tailwind colour names the
 * components already use (`bg-card`, `text-muted-foreground`, …).
 */
export function cssVariables(mode: ThemeMode): Record<string, string> {
  const p: Palette = PALETTE[mode];
  const hsl = hexToHslChannels;
  return {
    // Design tokens (hex), for hand-written CSS.
    "--g-bg-canvas": p.canvas,
    "--g-surface": p.surface,
    "--g-surface-alt": p.surfaceAlt,
    "--g-elevated": p.elevated,
    "--g-text-primary": p.textPrimary,
    "--g-text-secondary": p.textSecondary,
    "--g-border-subtle": p.borderSubtle,
    "--g-accent-primary": p.primary,
    "--g-accent-primary-hover": p.primaryHover,
    "--g-accent-primary-container": p.primaryContainer,
    "--g-accent-on-primary-container": p.onPrimaryContainer,
    "--g-success": p.success,
    "--g-success-container": p.successContainer,
    "--g-warning": p.warning,
    "--g-warning-container": p.warningContainer,
    "--g-danger": p.danger,
    "--g-danger-container": p.dangerContainer,
    "--g-gradient-expressive": GRADIENTS.expressive,
    "--g-gradient-google": GRADIENTS.google,
    "--g-wash": GRADIENTS.wash,
    "--g-shadow-resting": ELEVATION.resting,
    "--g-shadow-raised": ELEVATION.raised,
    "--g-ease": MOTION.easing,
    "--g-radius-card": RADII.card,
    "--g-radius-dialog": RADII.dialog,
    "--g-radius-field": RADII.field,
    "--font-display": TYPOGRAPHY.display,
    "--font-sans": TYPOGRAPHY.body,
    "--font-mono": TYPOGRAPHY.mono,

    // HSL channels for the Tailwind colour utilities.
    "--background": hsl(p.canvas),
    "--foreground": hsl(p.textPrimary),
    "--card": hsl(p.surface),
    "--card-foreground": hsl(p.textPrimary),
    "--popover": hsl(p.elevated),
    "--popover-foreground": hsl(p.textPrimary),
    "--elevated": hsl(p.elevated),
    "--surface-alt": hsl(p.surfaceAlt),
    "--primary": hsl(p.primary),
    "--primary-hover": hsl(p.primaryHover),
    "--primary-foreground": hsl(p.onPrimary),
    "--primary-ink": hsl(p.onPrimaryContainer),
    "--primary-container": hsl(p.primaryContainer),
    "--on-primary-container": hsl(p.onPrimaryContainer),
    "--secondary": hsl(p.chip),
    "--secondary-foreground": hsl(p.textPrimary),
    "--muted": hsl(p.surfaceAlt),
    "--muted-foreground": hsl(p.textSecondary),
    "--accent": hsl(p.surfaceAlt),
    "--accent-foreground": hsl(p.textPrimary),
    "--destructive": hsl(p.danger),
    "--destructive-ink": hsl(p.dangerInk),
    "--destructive-container": hsl(p.dangerContainer),
    "--destructive-foreground": hsl(p.onDanger),
    "--success": hsl(p.success),
    "--success-ink": hsl(p.successInk),
    "--success-container": hsl(p.successContainer),
    "--success-foreground": hsl(p.onPrimary),
    "--warning": hsl(p.warning),
    "--warning-ink": hsl(p.warningInk),
    "--warning-container": hsl(p.warningContainer),
    "--warning-foreground": hsl(p.textPrimary),
    "--border": hsl(p.borderSubtle),
    "--input": hsl(p.borderSubtle),
    "--input-hover": hsl(p.borderStrong),
    "--ring": hsl(p.primary),
    "--radius": RADII.card,

    // Chart tokens.
    "--viz-in": hsl(p.vizGreen),
    "--viz-out": hsl(p.vizBlue),
    "--viz-interest": hsl(p.vizYellow),
    "--viz-principal": hsl(p.vizBlue),
    "--viz-balance": hsl(p.vizViolet),
    "--viz-trap": hsl(p.vizRed),
    "--viz-grid": hsl(p.vizGrid),
  };
}
