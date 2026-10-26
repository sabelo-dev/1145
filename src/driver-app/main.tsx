import { registerServiceWorker } from "@/lib/registerSW";
import UpdatePrompt from "@/components/UpdatePrompt";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeCustomizationProvider } from "@/contexts/ThemeCustomizationContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GoldPricingProvider } from "@/contexts/GoldPricingContext";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import PasswordChangeGate from "@/components/auth/PasswordChangeGate";
import AppInviteClaim from "@/components/downloads/AppInviteClaim";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import DriverDashboardPage from "@/pages/driver/DriverDashboardPage";
import DriverLoginPage from "@/pages/driver/DriverLoginPage";
import DriverRegisterPage from "@/pages/driver/DriverRegisterPage";
import DriverOnboardingPage from "@/pages/driver/DriverOnboardingPage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import { initNative } from "@/lib/native";
import { Button } from "@/components/ui/button";
import "@/index.css";

const queryClient = new QueryClient();
function DriverGate() {
  const { user, isLoading, isDriver, logout } = useAuth();
  if (isLoading) return <p className="p-6" data-app-loading>Loading 1145 Driver...</p>;
  if (!user) return <Navigate to="/driver/login" replace />;
  if (!isDriver) return <div className="space-y-4 p-6"><h1 className="text-xl font-bold">Driver account required</h1><p>Sign in with your approved 1145 driver account.</p><Button onClick={() => void logout()}>Sign out</Button></div>;
  return <DriverDashboardPage />;
}
createRoot(document.getElementById("root")!).render(
  <HelmetProvider><ErrorBoundary><ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <ThemeCustomizationProvider><QueryClientProvider client={queryClient}><AuthProvider><GoldPricingProvider><WishlistProvider><CartProvider>
      <BrowserRouter><Routes>
        <Route path="/driver/login" element={<DriverLoginPage />} />
        <Route path="/login" element={<Navigate to="/driver/login" replace />} />
        <Route path="/driver/register" element={<DriverRegisterPage />} />
        <Route path="/driver/onboarding" element={<DriverOnboardingPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="*" element={<DriverGate />} />
      </Routes><PasswordChangeGate /><AppInviteClaim app="driver" /><UpdatePrompt /><Toaster /><Sonner /></BrowserRouter>
    </CartProvider></WishlistProvider></GoldPricingProvider></AuthProvider></QueryClientProvider></ThemeCustomizationProvider>
  </ThemeProvider></ErrorBoundary></HelmetProvider>,
);
void initNative();

registerServiceWorker();
