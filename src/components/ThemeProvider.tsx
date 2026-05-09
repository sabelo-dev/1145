import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

// Force light mode on mobile, reactive to viewport changes (resize / rotate / devtools).
function MobileThemeEnforcer({ children }: { children: React.ReactNode }) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile && (theme === "dark" || resolvedTheme === "dark")) {
      setTheme("light");
    }
  }, [isMobile, theme, resolvedTheme, setTheme]);

  return <>{children}</>;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <MobileThemeEnforcer>{children}</MobileThemeEnforcer>
    </NextThemesProvider>
  );
}
