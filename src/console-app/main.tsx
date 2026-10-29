// Entry point of the "1145 Orders" Android app (orders.html, built with
// vite.orders.config.ts and packaged by Capacitor into android-orders/).
// It contains only the order console and what it needs: no shop, rides or
// other 1145 modules. The same console runs on the web at /merchant/console.
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SplashScreen } from "@capacitor/splash-screen";
import { ThemeProvider } from "@/components/ThemeProvider";
import NativeUpdatePrompt from "@/components/NativeUpdatePrompt";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { refetchOnAppResume } from "@/lib/queryFocus";
import PasswordChangeGate from "@/components/auth/PasswordChangeGate";
import AppInviteClaim from "@/components/downloads/AppInviteClaim";
import { AuthProvider } from "@/contexts/AuthContext";
import MerchantConsolePage from "@/pages/MerchantConsolePage";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});
refetchOnAppResume();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* Nothing in the console navigates; the router only satisfies shared components. */}
            <MemoryRouter initialEntries={["/merchant/console"]}>
              <MerchantConsolePage />
              <PasswordChangeGate />
              <AppInviteClaim app="orders" />
              <NativeUpdatePrompt />
              <Toaster />
              <Sonner />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </HelmetProvider>,
);

void SplashScreen.hide().catch(() => undefined);
