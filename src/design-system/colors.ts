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
    900: "#0B1020", // Midnight Navy
    800: "#11182D", // Deep Navy
    700: "#18213A", // Navy
    border: "#33405F",
  },
  accent: {
    cyan: "#00D4FF", // Electric Cyan — interaction
    cyanSoft: "#E6FAFF",
    gold: "#D4AF37", // Time Gold — value
  },
  surface: {
    white: "#FFFFFF",
    soft: "#F4F6F9",
    border: "#E2E7EF",
  },
  text: {
    primary: "#202532",
    secondary: "#667085",
    inverse: "#FFFFFF",
  },
  status: {
    success: "#16A34A",
    warning: "#F59E0B",
    error: "#DC2626",
    info: "#2563EB",
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
