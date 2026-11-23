// Entry point of the "1145 Merchant" Android app (merchant.html, built with
// vite.merchant.config.ts and packaged by Capacitor into android-merchant/).
// It holds the merchant dashboard (the same one as 1145.io/merchant/dashboard),
// the order console and POS it links to, and the sign-in, sign-up and store
// onboarding pages around them. Links to the rest of 1145 open the website.
import { Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeCustomizationProvider } from "@/contexts/ThemeCustomizationContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { GoldPricingProvider } from "@/contexts/GoldPricingContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { CartProvider } from "@/contexts/CartContext";
import { FoodCartProvider } from "@/contexts/FoodCartContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RoleOnboardingGate from "@/components/auth/RoleOnboardingGate";
import PasswordChangeGate from "@/components/auth/PasswordChangeGate";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { getAppUrl } from "@/lib/appUrl";
import { initNative, openExternal } from "@/lib/native";
import { refetchOnAppResume } from "@/lib/queryFocus";
import "@/index.css";

const MerchantDashboardPage = lazyWithRetry(() => import("@/pages/MerchantDashboardPage"));
const MerchantConsolePage = lazyWithRetry(() => import("@/pages/MerchantConsolePage"));
const MerchantLoginPage = lazyWithRetry(() => import("@/pages/MerchantLoginPage"));
const MerchantRegisterPage = lazyWithRetry(() => import("@/pages/MerchantRegisterPage"));
const MerchantOnboardingPage = lazyWithRetry(() => import("@/pages/MerchantOnboardingPage"));
const RegisterPage = lazyWithRetry(() => import("@/pages/RegisterPage"));
const VerifyEmailPage = lazyWithRetry(() => import("@/pages/VerifyEmailPage"));
const ForgotPasswordPage = lazyWithRetry(() => import("@/pages/ForgotPasswordPage"));
const AuthCallbackPage = lazyWithRetry(() => import("@/pages/AuthCallbackPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});
refetchOnAppResume();

const Loading = () => (
  <div className="flex min-h-screen items-center justify-center" data-app-loading>
    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
  </div>
);

/** Signed in, but not with a merchant account (the login pages send them to /dashboard). */
function MerchantAccountRequired() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  if (isLoading) return <Loading />;
  if (!user) return <Navigate to="/merchant/login" replace />;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center space-y-4 p-6">
      <h1 className="text-xl font-bold">Merchant account required</h1>
      <p className="text-muted-foreground">
        {user.email} isn't a merchant account. Register your business to open a store, or sign in with your merchant account.
      </p>
      <Button onClick={() => navigate("/merchant/register")}>Register a business</Button>
      <Button variant="outline" onClick={() => void logout()}>Sign out</Button>
    </div>
  );
}

/** Pages that live on the website (a public storefront, the shop, wallets): open them there. */
function OpenOnWebsite() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    void openExternal(getAppUrl(`${pathname}${search}`));
  }, [pathname, search]);
  return <Navigate to="/merchant/dashboard" replace />;
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeCustomizationProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <GoldPricingProvider>
                <WishlistProvider>
                  <CartProvider>
                    <FoodCartProvider>
                      <BrowserRouter>
                        <Suspense fallback={<Loading />}>
                          <Routes>
                            <Route path="/" element={<Navigate to="/merchant/dashboard" replace />} />
                            <Route path="/merchant" element={<Navigate to="/merchant/dashboard" replace />} />
                            <Route path="/login" element={<Navigate to="/merchant/login" replace />} />
                            <Route path="/merchant/login" element={<MerchantLoginPage />} />
                            <Route path="/merchant/register" element={<MerchantRegisterPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                            <Route path="/verify-email" element={<VerifyEmailPage />} />
                            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                            <Route path="/auth/callback" element={<AuthCallbackPage />} />
                            <Route path="/merchant/onboarding" element={
                              <ProtectedRoute requireAuth>
                                <MerchantOnboardingPage />
                              </ProtectedRoute>
                            } />
                            <Route path="/merchant/dashboard" element={
                              <ProtectedRoute requireAuth requireMerchant>
                                <RoleOnboardingGate role="merchant">
                                  <MerchantDashboardPage />
                                </RoleOnboardingGate>
                              </ProtectedRoute>
                            } />
                            {/* The order console and POS: signs in itself and checks store access in the database. */}
                            <Route path="/merchant/console" element={<MerchantConsolePage />} />
                            <Route path="/dashboard" element={<MerchantAccountRequired />} />
                            <Route path="/admin/dashboard" element={<MerchantAccountRequired />} />
                            <Route path="*" element={<OpenOnWebsite />} />
                          </Routes>
                        </Suspense>
                        <PasswordChangeGate />
                        <Toaster />
                        <Sonner />
                      </BrowserRouter>
                    </FoodCartProvider>
                  </CartProvider>
                </WishlistProvider>
              </GoldPricingProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeCustomizationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </HelmetProvider>,
);

void initNative();
