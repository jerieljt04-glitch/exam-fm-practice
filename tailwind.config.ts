import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

import { ELEVATION, GRADIENTS, MOTION, RADII, TYPOGRAPHY, cssVariables } from "./lib/theme/tokens";

const channel = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

/**
 * Tailwind theme driven by lib/theme/tokens.ts: the plugin below writes every
 * token to :root (light) and to a prefers-color-scheme: dark block, and the
 * colour names here read those variables.
 */
const config: Config = {
  darkMode: "media",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: channel("border"),
        input: channel("input"),
        ring: channel("ring"),
        background: channel("background"),
        foreground: channel("foreground"),
        canvas: channel("background"),
        elevated: channel("elevated"),
        surface: { DEFAULT: channel("card"), alt: channel("surface-alt") },
        primary: {
          DEFAULT: channel("primary"),
          hover: channel("primary-hover"),
          foreground: channel("primary-foreground"),
          container: channel("primary-container"),
          "on-container": channel("on-primary-container"),
        },
        secondary: { DEFAULT: channel("secondary"), foreground: channel("secondary-foreground") },
        destructive: {
          DEFAULT: channel("destructive"),
          ink: channel("destructive-ink"),
          container: channel("destructive-container"),
          foreground: channel("destructive-foreground"),
        },
        success: { DEFAULT: channel("success"), ink: channel("success-ink"), container: channel("success-container"), foreground: channel("success-foreground") },
        warning: { DEFAULT: channel("warning"), ink: channel("warning-ink"), container: channel("warning-container"), foreground: channel("warning-foreground") },
        muted: { DEFAULT: channel("muted"), foreground: channel("muted-foreground") },
        accent: { DEFAULT: channel("accent"), foreground: channel("accent-foreground") },
        popover: { DEFAULT: channel("popover"), foreground: channel("popover-foreground") },
        card: { DEFAULT: channel("card"), foreground: channel("card-foreground") },
      },
      // Text in a status colour always uses its readable ink (AA on every surface);
      // fills (bg-success, bg-destructive …) keep the bright Google accent.
      textColor: {
        primary: {
          DEFAULT: channel("primary-ink"),
          foreground: channel("primary-foreground"),
          "on-container": channel("on-primary-container"),
        },
        success: { DEFAULT: channel("success-ink"), foreground: channel("success-foreground") },
        warning: { DEFAULT: channel("warning-ink"), foreground: channel("warning-foreground") },
        destructive: { DEFAULT: channel("destructive-ink"), foreground: channel("destructive-foreground") },
      },
      borderRadius: {
        pill: RADII.pill,
        field: RADII.field,
        card: RADII.card,
        "card-lg": RADII.cardLarge,
        dialog: RADII.dialog,
        lg: RADII.card,
        md: RADII.field,
        sm: "8px",
      },
      boxShadow: { resting: ELEVATION.resting, raised: ELEVATION.raised },
      backgroundImage: { expressive: GRADIENTS.expressive, google: GRADIENTS.google, wash: GRADIENTS.wash },
      fontFamily: {
        sans: TYPOGRAPHY.body.split(",").map((f) => f.trim().replace(/"/g, "")),
        display: TYPOGRAPHY.display.split(",").map((f) => f.trim().replace(/"/g, "")),
        mono: TYPOGRAPHY.mono.split(",").map((f) => f.trim().replace(/"/g, "")),
      },
      transitionTimingFunction: { emphasized: MOTION.easing },
      transitionDuration: { fast: MOTION.fast, medium: MOTION.medium, slow: MOTION.slow },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "scale(0.98)" }, to: { opacity: "1", transform: "scale(1)" } },
        rise: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": `fade-in ${MOTION.medium} ${MOTION.easing} forwards`,
        rise: `rise ${MOTION.slow} ${MOTION.easing} both`,
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      // Light by default; dark when the system asks for it, unless the viewer chose light;
      // and always dark when the viewer chose dark (data-theme set by the theme toggle).
      addBase({
        ":root": { ...cssVariables("light"), colorScheme: "light" },
        "@media (prefers-color-scheme: dark)": { ':root:not([data-theme="light"])': { ...cssVariables("dark"), colorScheme: "dark" } },
        ':root[data-theme="dark"]': { ...cssVariables("dark"), colorScheme: "dark" },
      });
    }),
  ],
};

export default config;
