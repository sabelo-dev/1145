import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeCustomizationProvider } from "@/contexts/ThemeCustomizationContext";
import { GoldPricingProvider } from "@/contexts/GoldPricingContext";
import { Toaster } from "@/components/ui/toaster";
import TrackOrderPage from "./pages/TrackOrderPage";
import StorefrontPage from "@/pages/StorefrontPage";
import Layout from "@/components/layout/Layout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

// Page imports
import Index from "@/pages/Index";
import HomePage from "@/pages/HomePage";
import ShopPage from "@/pages/ShopPage";
import ProductPage from "@/pages/ProductPage";
import CategoryPage from "@/pages/CategoryPage";
import CategoriesPage from "@/pages/CategoriesPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import CheckoutPage from "@/pages/CheckoutPage";
import CheckoutSuccessPage from "@/pages/CheckoutSuccessPage";
import CheckoutCancelPage from "@/pages/CheckoutCancelPage";
import ConsumerDashboard from "@/pages/ConsumerDashboard";
import ContactPage from "@/pages/ContactPage";
import FAQPage from "@/pages/FAQPage";
import NotFound from "@/pages/NotFound";

// Admin pages
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import AdminDashboard from "@/pages/admin/AdminDashboard";

// Vendor pages
import VendorLoginPage from "@/pages/VendorLoginPage";
import VendorRegisterPage from "@/pages/VendorRegisterPage";
import VendorOnboardingPage from "@/pages/VendorOnboardingPage";
import VendorDashboardPage from "@/pages/VendorDashboardPage";

// Driver pages
import DriverLoginPage from "@/pages/driver/DriverLoginPage";
import DriverDashboardPage from "@/pages/driver/DriverDashboardPage";
import DriverRegisterPage from "@/pages/driver/DriverRegisterPage";

// Influencer pages
import InfluencerLoginPage from "@/pages/influencer/InfluencerLoginPage";
import InfluencerDashboardPage from "@/pages/influencer/InfluencerDashboardPage";

// Subcategory pages
import SubcategoryPage from "@/pages/SubcategoryPage";

// Special pages
import BestSellersPage from "@/pages/BestSellersPage";
import NewArrivalsPage from "@/pages/NewArrivalsPage";
import DealsPage from "@/pages/DealsPage";
import PopularPage from "@/pages/PopularPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import AuctionsPage from "@/pages/AuctionsPage";
import AuctionRegistrationPage from "@/pages/AuctionRegistrationPage";
import AuctionRegistrationSuccessPage from "@/pages/AuctionRegistrationSuccessPage";
import AuctionCheckoutPage from "@/pages/AuctionCheckoutPage";
import AuctionCheckoutSuccessPage from "@/pages/AuctionCheckoutSuccessPage";

// Policy pages
import ShippingPage from "@/pages/ShippingPage";
import ReturnsPage from "@/pages/ReturnsPage";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";

// Auth pages
import AuthConfirmPage from "@/pages/AuthConfirmPage";

const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <ThemeCustomizationProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GoldPricingProvider>
        <WishlistProvider>
          <CartProvider>
            <Router>
            <Routes>
              {/* Landing page without layout */}
              <Route index element={<Index />} />
              
              {/* Home page with integrated header */}
              <Route path="home" element={<HomePage />} />
              
              <Route path="/" element={<Layout />}>
                <Route path="shop" element={<ShopPage />} />
                <Route path="store/:storeSlug" element={<StorefrontPage />} />
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
                
                {/* Special category pages */}
                <Route path="best-sellers" element={<BestSellersPage />} />
                <Route path="new-arrivals" element={<NewArrivalsPage />} />
                <Route path="deals" element={<DealsPage />} />
                <Route path="popular" element={<PopularPage />} />
                <Route path="auctions" element={<AuctionsPage />} />
                <Route path="auction-registration" element={<AuctionRegistrationPage />} />
                <Route path="auction-registration/success" element={<AuctionRegistrationSuccessPage />} />
                <Route path="auction-checkout" element={<AuctionCheckoutPage />} />
                <Route path="auction-checkout/success" element={<AuctionCheckoutSuccessPage />} />
                
                {/* Policy pages */}
                <Route path="shipping" element={<ShippingPage />} />
                <Route path="returns" element={<ReturnsPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
              </Route>
              
              {/* Track Order page */}
              <Route path="track-order" element={<TrackOrderPage />} />
              
              {/* Auth pages without layout */}
              <Route path="auth/confirm" element={<AuthConfirmPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              
              {/* Admin pages */}
              <Route path="admin/login" element={<AdminLoginPage />} />
              <Route path="admin/dashboard" element={
                <ProtectedRoute requireAuth requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              
              {/* Vendor pages */}
              <Route path="vendor/login" element={<VendorLoginPage />} />
              <Route path="vendor/register" element={<VendorRegisterPage />} />
              <Route path="vendor/onboarding" element={
                <ProtectedRoute requireAuth requireVendor>
                  <VendorOnboardingPage />
                </ProtectedRoute>
              } />
              <Route path="vendor/dashboard" element={
                <ProtectedRoute requireAuth requireVendor>
                  <VendorDashboardPage />
                </ProtectedRoute>
              } />
              
              {/* Driver pages */}
              <Route path="driver/login" element={<DriverLoginPage />} />
              <Route path="driver/register" element={<DriverRegisterPage />} />
              <Route path="driver/dashboard" element={
                <ProtectedRoute requireAuth requireDriver>
                  <DriverDashboardPage />
                </ProtectedRoute>
              } />
              
              {/* Influencer pages */}
              <Route path="influencer/login" element={<InfluencerLoginPage />} />
              <Route path="influencer/dashboard" element={
                <ProtectedRoute requireAuth requireInfluencer>
                  <InfluencerDashboardPage />
                </ProtectedRoute>
              } />
              
              {/* 404 page */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
            </Router>
          </CartProvider>
        </WishlistProvider>
        </GoldPricingProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ThemeCustomizationProvider>
    </ThemeProvider>
  );
}

export default App;
