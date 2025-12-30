import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

// Component to force light mode on mobile
function MobileThemeEnforcer({ children }: { children: React.ReactNode }) {
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile && theme === "dark") {
        setTheme("light");
      }
    };

    // Check on mount
    checkMobile();

    // Check on resize
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [setTheme, theme]);

  return <>{children}</>;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <MobileThemeEnforcer>{children}</MobileThemeEnforcer>
    </NextThemesProvider>
  );
}
