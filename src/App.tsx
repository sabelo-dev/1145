import React, { Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeCustomizationProvider } from "@/contexts/ThemeCustomizationContext";
import { GoldPricingProvider } from "@/contexts/GoldPricingContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import UpdatePrompt from "@/components/UpdatePrompt";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/ui/page-loader";
import { useCustomDomainResolver } from "@/hooks/useCustomDomainResolver";

// Eagerly loaded (critical path)
import Layout from "@/components/layout/Layout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import RoleDashboardRedirect from "@/components/auth/RoleDashboardRedirect";
import RoleOnboardingGate from "@/components/auth/RoleOnboardingGate";
import ScrollToTop from "@/components/ScrollToTop";

// Lazy loaded pages
const Index = lazyWithRetry(() => import("@/pages/Index"));
const HomePage = lazyWithRetry(() => import("@/pages/HomePage"));
const ShopPage = lazyWithRetry(() => import("@/pages/ShopPage"));
const ProductPage = lazyWithRetry(() => import("@/pages/ProductPage"));

const CategoryPage = lazyWithRetry(() => import("@/pages/CategoryPage"));
const CategoriesPage = lazyWithRetry(() => import("@/pages/CategoriesPage"));
const LoginPage = lazyWithRetry(() => import("@/pages/LoginPage"));
const RegisterPage = lazyWithRetry(() => import("@/pages/RegisterPage"));
const CheckoutPage = lazyWithRetry(() => import("@/pages/CheckoutPage"));
const CheckoutSuccessPage = lazyWithRetry(() => import("@/pages/CheckoutSuccessPage"));
const CheckoutCancelPage = lazyWithRetry(() => import("@/pages/CheckoutCancelPage"));
const ConsumerDashboard = lazyWithRetry(() => import("@/pages/ConsumerDashboard"));
const ContactPage = lazyWithRetry(() => import("@/pages/ContactPage"));
const FAQPage = lazyWithRetry(() => import("@/pages/FAQPage"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const StorefrontPage = lazyWithRetry(() => import("@/pages/StorefrontPage"));
const TrackOrderPage = lazyWithRetry(() => import("@/pages/TrackOrderPage"));
const OrderTrackingPage = lazyWithRetry(() => import("@/pages/OrderTrackingPage"));

// Admin
const AdminLoginPage = lazyWithRetry(() => import("@/pages/admin/AdminLoginPage"));
const AdminDashboard = lazyWithRetry(() => import("@/pages/admin/AdminDashboard"));
const AdminMiningPage = lazyWithRetry(() => import("@/pages/admin/AdminMiningPage"));
const AdminSocialConnectionsPage = lazyWithRetry(() => import("@/pages/admin/AdminSocialConnectionsPage"));
const MiningDashboardPage = lazyWithRetry(() => import("@/pages/MiningDashboardPage"));

// Merchant
const MerchantLoginPage = lazyWithRetry(() => import("@/pages/MerchantLoginPage"));
const MerchantRegisterPage = lazyWithRetry(() => import("@/pages/MerchantRegisterPage"));
const MerchantOnboardingPage = lazyWithRetry(() => import("@/pages/MerchantOnboardingPage"));
const MerchantDashboardPage = lazyWithRetry(() => import("@/pages/MerchantDashboardPage"));

// Driver
const DriverLoginPage = lazyWithRetry(() => import("@/pages/driver/DriverLoginPage"));
const DriverDashboardPage = lazyWithRetry(() => import("@/pages/driver/DriverDashboardPage"));
const DriverRegisterPage = lazyWithRetry(() => import("@/pages/driver/DriverRegisterPage"));
const DriverOnboardingPage = lazyWithRetry(() => import("@/pages/driver/DriverOnboardingPage"));
const FleetDashboardPage = lazyWithRetry(() => import("@/pages/fleet/FleetDashboardPage"));

// Influencer
const InfluencerLoginPage = lazyWithRetry(() => import("@/pages/influencer/InfluencerLoginPage"));
const InfluencerDashboardPage = lazyWithRetry(() => import("@/pages/influencer/InfluencerDashboardPage"));
const InfluencerOnboardingPage = lazyWithRetry(() => import("@/pages/influencer/InfluencerOnboardingPage"));
const InfluencerSocialConnectionsPage = lazyWithRetry(() => import("@/pages/influencer/InfluencerSocialConnectionsPage"));

// Subcategory & special pages
const SubcategoryPage = lazyWithRetry(() => import("@/pages/SubcategoryPage"));
const BestSellersPage = lazyWithRetry(() => import("@/pages/BestSellersPage"));
const NewArrivalsPage = lazyWithRetry(() => import("@/pages/NewArrivalsPage"));
const DealsPage = lazyWithRetry(() => import("@/pages/DealsPage"));
const PopularPage = lazyWithRetry(() => import("@/pages/PopularPage"));
const ForgotPasswordPage = lazyWithRetry(() => import("@/pages/ForgotPasswordPage"));
const AuctionsPage = lazyWithRetry(() => import("@/pages/AuctionsPage"));
const AuctionRegistrationPage = lazyWithRetry(() => import("@/pages/AuctionRegistrationPage"));
const AuctionRegistrationSuccessPage = lazyWithRetry(() => import("@/pages/AuctionRegistrationSuccessPage"));
const AuctionCheckoutPage = lazyWithRetry(() => import("@/pages/AuctionCheckoutPage"));
const AuctionCheckoutSuccessPage = lazyWithRetry(() => import("@/pages/AuctionCheckoutSuccessPage"));

// Policy pages
const ShippingPage = lazyWithRetry(() => import("@/pages/ShippingPage"));
const ReturnsPage = lazyWithRetry(() => import("@/pages/ReturnsPage"));
const TermsPage = lazyWithRetry(() => import("@/pages/TermsPage"));
const PrivacyPage = lazyWithRetry(() => import("@/pages/PrivacyPage"));

// Auth
const AuthConfirmPage = lazyWithRetry(() => import("@/pages/AuthConfirmPage"));
const VerifyEmailPage = lazyWithRetry(() => import("@/pages/VerifyEmailPage"));

// Super App
const ServiceHubPage = lazyWithRetry(() => import("@/pages/ServiceHubPage"));
const RideRequestPage = lazyWithRetry(() => import("@/pages/rides/RideRequestPage"));
const RideTrackingPage = lazyWithRetry(() => import("@/pages/rides/RideTrackingPage"));
const RideHistoryPage = lazyWithRetry(() => import("@/pages/rides/RideHistoryPage"));
const WalletPage = lazyWithRetry(() => import("@/pages/wallet/WalletPage"));
const FintechPage = lazyWithRetry(() => import("@/pages/wallet/FintechPage"));
const AdminFintechPage = lazyWithRetry(() => import("@/pages/admin/AdminFintechPage"));
const AdminOrderMonitoringPage = lazyWithRetry(() => import("@/pages/admin/AdminOrderMonitoringPage"));
const UCoinMarketPage = lazyWithRetry(() => import("@/pages/UCoinMarketPage"));
const UCoinWalletPage = lazyWithRetry(() => import("@/pages/UCoinWalletPage"));

const InstallPage = lazyWithRetry(() => import("@/pages/InstallPage"));
const LeaseApplyPage = lazyWithRetry(() => import("@/pages/LeaseApplyPage"));
const LeaseMarketplacePage = lazyWithRetry(() => import("@/pages/LeaseMarketplacePage"));
const AssetOwnerDashboard = lazyWithRetry(() => import("@/pages/AssetOwnerDashboard"));
const StaysPage = lazyWithRetry(() => import("@/pages/StaysPage"));
const StayDetailPage = lazyWithRetry(() => import("@/pages/StayDetailPage"));
const PackageSendPage = lazyWithRetry(() => import("@/pages/PackageSendPage"));

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
          <Route path="marketplace" element={<Navigate to="/store/marketplace" replace />} />
          <Route path="ucoin-market" element={<UCoinMarketPage />} />
          <Route path="ucoin-wallet" element={<UCoinWalletPage />} />

          <Route path="orders/:orderId/tracking" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />


          <Route path="categories" element={<CategoriesPage />} />
          <Route path="category/:categorySlug/:subcategorySlug" element={<SubcategoryPage />} />
          <Route path="category/:slug" element={<CategoryPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="checkout/cancel" element={<CheckoutCancelPage />} />
          <Route path="account" element={<Navigate to="/dashboard" replace />} />
          <Route path="consumer/dashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={
            <ProtectedRoute requireAuth requireVerified>
              <RoleDashboardRedirect>
                <ConsumerDashboard />
              </RoleDashboardRedirect>
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
            <ProtectedRoute requireAuth requireVerified>
              <LeaseApplyPage />
            </ProtectedRoute>
          } />
          <Route path="lease/marketplace" element={<LeaseMarketplacePage />} />
          <Route path="lease/my-assets" element={
            <ProtectedRoute requireAuth requireVerified>
              <AssetOwnerDashboard />
            </ProtectedRoute>
          } />
          <Route path="services" element={<ServiceHubPage />} />
        </Route>
        
        <Route path="package/send" element={<PackageSendPage />} />
        <Route path="stays" element={<Layout />}>
          <Route index element={<StaysPage />} />
          <Route path=":propertyId" element={<StayDetailPage />} />
        </Route>
        <Route path="rides" element={
          <ProtectedRoute requireAuth requireVerified>
            <RideHistoryPage />
          </ProtectedRoute>
        } />
        <Route path="rides/request" element={
          <ProtectedRoute requireAuth requireVerified>
            <RideRequestPage />
          </ProtectedRoute>
        } />
        <Route path="rides/track/:rideId" element={
          <ProtectedRoute requireAuth requireVerified>
            <RideTrackingPage />
          </ProtectedRoute>
        } />
        <Route path="wallet" element={
          <ProtectedRoute requireAuth requireVerified>
            <WalletPage />
          </ProtectedRoute>
        } />
        <Route path="wallet/mining" element={
          <ProtectedRoute requireAuth requireVerified>
            <MiningDashboardPage />
          </ProtectedRoute>
        } />
        <Route path="fintech" element={
          <ProtectedRoute requireAuth requireVerified>
            <FintechPage />
          </ProtectedRoute>
        } />
        <Route path="admin/fintech" element={
          <ProtectedRoute requireAuth requireAdmin>
            <AdminFintechPage />
          </ProtectedRoute>
        } />
        <Route path="track-order" element={<TrackOrderPage />} />
        
        <Route path="auth/confirm" element={<AuthConfirmPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />

        
        <Route path="admin/login" element={<AdminLoginPage />} />
        <Route path="admin/dashboard" element={
          <ProtectedRoute requireAuth requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="admin/order-monitoring" element={
          <ProtectedRoute requireAuth requireAdmin>
            <AdminOrderMonitoringPage />
          </ProtectedRoute>
        } />
        <Route path="admin/ucoin/mining" element={
          <ProtectedRoute requireAuth requireAdmin>
            <AdminMiningPage />
          </ProtectedRoute>
        } />
        <Route path="admin/social" element={
          <ProtectedRoute requireAuth requireAdmin>
            <AdminSocialConnectionsPage />
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
            <RoleOnboardingGate role="vendor">
              <MerchantDashboardPage />
            </RoleOnboardingGate>
          </ProtectedRoute>
        } />
        
        <Route path="vendor/login" element={<Navigate to="/merchant/login" replace />} />
        <Route path="vendor/register" element={<Navigate to="/merchant/register" replace />} />
        <Route path="vendor/onboarding" element={<Navigate to="/merchant/onboarding" replace />} />
        <Route path="vendor/dashboard" element={<Navigate to="/merchant/dashboard" replace />} />
        
        <Route path="driver/login" element={<DriverLoginPage />} />
        <Route path="driver/register" element={<DriverRegisterPage />} />
        <Route path="driver/onboarding" element={
          <ProtectedRoute requireAuth requireVerified>
            <DriverOnboardingPage />
          </ProtectedRoute>
        } />
        <Route path="driver/dashboard" element={
          <ProtectedRoute requireAuth requireDriver>
            <RoleOnboardingGate role="driver">
              <DriverDashboardPage />
            </RoleOnboardingGate>
          </ProtectedRoute>
        } />
        <Route path="fleet/dashboard" element={
          <ProtectedRoute requireAuth>
            <FleetDashboardPage />
          </ProtectedRoute>
        } />
        
        <Route path="influencer/login" element={<InfluencerLoginPage />} />
        <Route path="influencer/onboarding" element={
          <ProtectedRoute requireAuth requireVerified>
            <InfluencerOnboardingPage />
          </ProtectedRoute>
        } />
        <Route path="influencer/dashboard" element={
          <ProtectedRoute requireAuth requireInfluencer>
            <RoleOnboardingGate role="influencer">
              <InfluencerDashboardPage />
            </RoleOnboardingGate>
          </ProtectedRoute>
        } />
        <Route path="influencer/social" element={
          <ProtectedRoute requireAuth requireInfluencer>
            <InfluencerSocialConnectionsPage />
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
                      <ScrollToTop />
                      <AppRouter />
                      <Toaster />
                      <Sonner />
                      <UpdatePrompt />
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
