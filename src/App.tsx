import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { Toaster } from "@/components/ui/toaster";
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
import AccountPage from "@/pages/AccountPage";
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

// Subcategory pages
import SubcategoryPage from "@/pages/SubcategoryPage";

// Special pages
import BestSellersPage from "@/pages/BestSellersPage";
import NewArrivalsPage from "@/pages/NewArrivalsPage";
import DealsPage from "@/pages/DealsPage";
import PopularPage from "@/pages/PopularPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";

// Policy pages
import ShippingPage from "@/pages/ShippingPage";
import ReturnsPage from "@/pages/ReturnsPage";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
                <Route path="account" element={<AccountPage />} />
                <Route path="consumer/dashboard" element={
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
                
                
                {/* Policy pages */}
                <Route path="shipping" element={<ShippingPage />} />
                <Route path="returns" element={<ReturnsPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
              </Route>
              
              {/* Auth pages without layout */}
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
              <Route path="/driver/login" element={<DriverLoginPage />} />
              <Route path="/driver/dashboard" element={
                <ProtectedRoute requireAuth requireDriver>
                  <DriverDashboardPage />
                </ProtectedRoute>
              } />
              
              {/* 404 page */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
            </Router>
          </CartProvider>
        </WishlistProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
