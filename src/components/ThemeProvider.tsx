import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect, useLayoutEffect } from "react";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

// Hook to check if we're on mobile
const useIsMobile = () => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
};

// Component to force light mode on mobile
function MobileThemeEnforcer({ children }: { children: React.ReactNode }) {
  const { setTheme, theme, resolvedTheme } = useTheme();

  // Use layout effect for immediate enforcement before paint
  useLayoutEffect(() => {
    const enforceLightMode = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile && (theme === "dark" || resolvedTheme === "dark")) {
        setTheme("light");
      }
    };

    // Check immediately
    enforceLightMode();

    // Check on resize
    window.addEventListener("resize", enforceLightMode);
    return () => window.removeEventListener("resize", enforceLightMode);
  }, [setTheme, theme, resolvedTheme]);

  // Also enforce on any theme change
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile && (theme === "dark" || resolvedTheme === "dark")) {
      setTheme("light");
    }
  }, [theme, resolvedTheme, setTheme]);

  return <>{children}</>;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <MobileThemeEnforcer>{children}</MobileThemeEnforcer>
    </NextThemesProvider>
  );
}
