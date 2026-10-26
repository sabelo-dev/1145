/**
 * 1145 Unified Application Color System — single source of truth.
 *
 * Components should prefer the Tailwind semantic classes (bg-primary,
 * text-gold, bg-navy-900, …) which are wired to the CSS variables in
 * `src/index.css`. These raw values exist for non-CSS consumers
 * (charts, canvas/maps, native config, emails).
 */

export const colors = {
  primary: {
    900: "#0B1426", // Midnight Navy
    800: "#121E36", // Deep Navy
    700: "#1B2946", // Navy
    border: "#32405D",
  },
  accent: {
    cyan: "#087BFF", // Electric Blue — interaction
    cyanSoft: "#EAF3FF",
    gold: "#D6A84B", // Champagne Gold — value
  },
  surface: {
    white: "#FFFFFF",
    soft: "#F5F7FB", // Cloud White
    border: "#E4E6EB",
  },
  text: {
    primary: "#202532",
    secondary: "#66707F",
    inverse: "#FFFFFF",
  },
  status: {
    success: "#16863F",
    warning: "#F59E0B",
    error: "#DC2626",
    info: "#006FE6",
    disabled: "#98A2B3",
  },
} as const;

/** Ride module map/route colors. */
export const rideColors = {
  route: colors.accent.cyan,
  pickup: colors.status.success,
  destination: colors.status.error,
  currentLocation: colors.accent.cyan,
} as const;

/** Approved gradients — use sparingly (heroes, wallet headers, auth). */
export const gradients = {
  brand: `linear-gradient(135deg, ${colors.primary[900]} 0%, ${colors.primary[700]} 55%, ${colors.accent.cyan} 100%)`,
  premium: `linear-gradient(135deg, ${colors.primary[900]} 0%, ${colors.primary[700]} 60%, ${colors.accent.gold} 100%)`,
} as const;

export type AppColors = typeof colors;
export default colors;
