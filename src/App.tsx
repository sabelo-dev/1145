import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeCustomizationProvider } from "@/contexts/ThemeCustomizationContext";
import { GoldPricingProvider } from "@/contexts/GoldPricingContext";
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/ui/page-loader";
import { useCustomDomainResolver } from "@/hooks/useCustomDomainResolver";

// Eagerly loaded (critical path)
import Layout from "@/components/layout/Layout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

// Lazy loaded pages
const Index = lazy(() => import("@/pages/Index"));
const HomePage = lazy(() => import("@/pages/HomePage"));
const ShopPage = lazy(() => import("@/pages/ShopPage"));
const ProductPage = lazy(() => import("@/pages/ProductPage"));
const CategoryPage = lazy(() => import("@/pages/CategoryPage"));
const CategoriesPage = lazy(() => import("@/pages/CategoriesPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const CheckoutSuccessPage = lazy(() => import("@/pages/CheckoutSuccessPage"));
const CheckoutCancelPage = lazy(() => import("@/pages/CheckoutCancelPage"));
const ConsumerDashboard = lazy(() => import("@/pages/ConsumerDashboard"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const FAQPage = lazy(() => import("@/pages/FAQPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const StorefrontPage = lazy(() => import("@/pages/StorefrontPage"));
const TrackOrderPage = lazy(() => import("@/pages/TrackOrderPage"));

// Admin
const AdminLoginPage = lazy(() => import("@/pages/admin/AdminLoginPage"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));

// Merchant
const MerchantLoginPage = lazy(() => import("@/pages/MerchantLoginPage"));
const MerchantRegisterPage = lazy(() => import("@/pages/MerchantRegisterPage"));
const MerchantOnboardingPage = lazy(() => import("@/pages/MerchantOnboardingPage"));
const MerchantDashboardPage = lazy(() => import("@/pages/MerchantDashboardPage"));

// Driver
const DriverLoginPage = lazy(() => import("@/pages/driver/DriverLoginPage"));
const DriverDashboardPage = lazy(() => import("@/pages/driver/DriverDashboardPage"));
const DriverRegisterPage = lazy(() => import("@/pages/driver/DriverRegisterPage"));
const FleetDashboardPage = lazy(() => import("@/pages/fleet/FleetDashboardPage"));

// Influencer
const InfluencerLoginPage = lazy(() => import("@/pages/influencer/InfluencerLoginPage"));
const InfluencerDashboardPage = lazy(() => import("@/pages/influencer/InfluencerDashboardPage"));

// Subcategory & special pages
const SubcategoryPage = lazy(() => import("@/pages/SubcategoryPage"));
const BestSellersPage = lazy(() => import("@/pages/BestSellersPage"));
const NewArrivalsPage = lazy(() => import("@/pages/NewArrivalsPage"));
const DealsPage = lazy(() => import("@/pages/DealsPage"));
const PopularPage = lazy(() => import("@/pages/PopularPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const AuctionsPage = lazy(() => import("@/pages/AuctionsPage"));
const AuctionRegistrationPage = lazy(() => import("@/pages/AuctionRegistrationPage"));
const AuctionRegistrationSuccessPage = lazy(() => import("@/pages/AuctionRegistrationSuccessPage"));
const AuctionCheckoutPage = lazy(() => import("@/pages/AuctionCheckoutPage"));
const AuctionCheckoutSuccessPage = lazy(() => import("@/pages/AuctionCheckoutSuccessPage"));

// Policy pages
const ShippingPage = lazy(() => import("@/pages/ShippingPage"));
const ReturnsPage = lazy(() => import("@/pages/ReturnsPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));

// Auth
const AuthConfirmPage = lazy(() => import("@/pages/AuthConfirmPage"));

// Super App
const ServiceHubPage = lazy(() => import("@/pages/ServiceHubPage"));
const RideRequestPage = lazy(() => import("@/pages/rides/RideRequestPage"));
const RideTrackingPage = lazy(() => import("@/pages/rides/RideTrackingPage"));
const RideHistoryPage = lazy(() => import("@/pages/rides/RideHistoryPage"));
const WalletPage = lazy(() => import("@/pages/wallet/WalletPage"));
const InstallPage = lazy(() => import("@/pages/InstallPage"));
const LeaseApplyPage = lazy(() => import("@/pages/LeaseApplyPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRouter() {
  const { isCustomDomain, resolvedStoreSlug, loading } = useCustomDomainResolver();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  if (isCustomDomain && resolvedStoreSlug) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="*" element={<StorefrontPage domainStoreSlug={resolvedStoreSlug} forceWhiteLabel />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route index element={<Index />} />
        <Route path="home" element={<HomePage />} />
        <Route path="install" element={<InstallPage />} />
        <Route path="store/:storeSlug" element={<StorefrontPage />} />
        
        <Route path="/" element={<Layout />}>
          <Route path="shop" element={<ShopPage />} />
          <Route path="product/:slug" element={<ProductPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="category/:categorySlug/:subcategorySlug" element={<SubcategoryPage />} />
          <Route path="category/:slug" element={<CategoryPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="checkout/cancel" element={<CheckoutCancelPage />} />
          <Route path="account" element={<Navigate to="/dashboard" replace />} />
          <Route path="consumer/dashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={
            <ProtectedRoute requireAuth>
              <ConsumerDashboard />
            </ProtectedRoute>
          } />
          <Route path="contact" element={<ContactPage />} />
          <Route path="faq" element={<FAQPage />} />
          <Route path="best-sellers" element={<BestSellersPage />} />
          <Route path="new-arrivals" element={<NewArrivalsPage />} />
          <Route path="deals" element={<DealsPage />} />
          <Route path="popular" element={<PopularPage />} />
          <Route path="auctions" element={<AuctionsPage />} />
          <Route path="auction-registration" element={<AuctionRegistrationPage />} />
          <Route path="auction-registration/success" element={<AuctionRegistrationSuccessPage />} />
          <Route path="auction-checkout" element={<AuctionCheckoutPage />} />
          <Route path="auction-checkout/success" element={<AuctionCheckoutSuccessPage />} />
          <Route path="shipping" element={<ShippingPage />} />
          <Route path="returns" element={<ReturnsPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="lease/apply/:assetId" element={
            <ProtectedRoute requireAuth>
              <LeaseApplyPage />
            </ProtectedRoute>
          } />
        </Route>
        
        <Route path="services" element={<ServiceHubPage />} />
        <Route path="rides" element={
          <ProtectedRoute requireAuth>
            <RideHistoryPage />
          </ProtectedRoute>
        } />
        <Route path="rides/request" element={
          <ProtectedRoute requireAuth>
            <RideRequestPage />
          </ProtectedRoute>
        } />
        <Route path="rides/track/:rideId" element={
          <ProtectedRoute requireAuth>
            <RideTrackingPage />
          </ProtectedRoute>
        } />
        <Route path="wallet" element={
          <ProtectedRoute requireAuth>
            <WalletPage />
          </ProtectedRoute>
        } />
        <Route path="track-order" element={<TrackOrderPage />} />
        
        <Route path="auth/confirm" element={<AuthConfirmPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        
        <Route path="admin/login" element={<AdminLoginPage />} />
        <Route path="admin/dashboard" element={
          <ProtectedRoute requireAuth requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        
        <Route path="merchant/login" element={<MerchantLoginPage />} />
        <Route path="merchant/register" element={<MerchantRegisterPage />} />
        <Route path="merchant/onboarding" element={
          <ProtectedRoute requireAuth>
            <MerchantOnboardingPage />
          </ProtectedRoute>
        } />
        <Route path="merchant/dashboard" element={
          <ProtectedRoute requireAuth requireMerchant>
            <MerchantDashboardPage />
          </ProtectedRoute>
        } />
        
        <Route path="vendor/login" element={<Navigate to="/merchant/login" replace />} />
        <Route path="vendor/register" element={<Navigate to="/merchant/register" replace />} />
        <Route path="vendor/onboarding" element={<Navigate to="/merchant/onboarding" replace />} />
        <Route path="vendor/dashboard" element={<Navigate to="/merchant/dashboard" replace />} />
        
        <Route path="driver/login" element={<DriverLoginPage />} />
        <Route path="driver/register" element={<DriverRegisterPage />} />
        <Route path="driver/dashboard" element={
          <ProtectedRoute requireAuth requireDriver>
            <DriverDashboardPage />
          </ProtectedRoute>
        } />
        <Route path="fleet/dashboard" element={
          <ProtectedRoute requireAuth>
            <FleetDashboardPage />
          </ProtectedRoute>
        } />
        
        <Route path="influencer/login" element={<InfluencerLoginPage />} />
        <Route path="influencer/dashboard" element={
          <ProtectedRoute requireAuth requireInfluencer>
            <InfluencerDashboardPage />
          </ProtectedRoute>
        } />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeCustomizationProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <GoldPricingProvider>
                <WishlistProvider>
                  <CartProvider>
                    <Router>
                      <AppRouter />
                      <Toaster />
                    </Router>
                  </CartProvider>
                </WishlistProvider>
              </GoldPricingProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeCustomizationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
