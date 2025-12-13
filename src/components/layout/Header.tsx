import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import CartSheet from "@/components/shop/CartSheet";
import { Search, ShoppingCart, Menu, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import UserMenu from "./header/UserMenu";
import Navigation from "./header/Navigation";
import MobileMenu from "./header/MobileMenu";

const Header: React.FC = () => {
  const { user, logout, isAdmin, isVendor } = useAuth();
  const { cart, toggleCart, isCartOpen, setCartOpen } = useCart();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Get items and subtotal from cart
  const items = cart?.items || [];

  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex items-center">
            <img src="/uploads/logo.png" alt="1145 Lifestyle" className="h-10" />
          </Link>

          {/* Desktop Navigation */}
          <Navigation />

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Search Button */}
            <Button variant="ghost" size="icon">
              <Search className="h-5 w-5" />
            </Button>

            {/* User Menu */}
            <UserMenu user={user} isAdmin={isAdmin} isVendor={isVendor} logout={logout} />

            {/* Cart Button */}
            <Button onClick={toggleCart} variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {items.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-xs w-5 h-5 flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button onClick={toggleCart} className="relative p-2 mr-2" aria-label="Cart">
              <ShoppingCart className="h-6 w-6" />
              {items.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-xs w-5 h-5 flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </button>
            <button
              onClick={toggleMobileMenu}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <MobileMenu
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        user={user}
        isAdmin={isAdmin}
        isVendor={isVendor}
        logout={logout}
      />

      {/* Cart Offcanvas */}
      <CartSheet isOpen={isCartOpen} setIsOpen={setCartOpen} />
    </header>
  );
};

export default Header;
