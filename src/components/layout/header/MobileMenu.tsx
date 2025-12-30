import React from "react";
import { Link } from "react-router-dom";
import { Search, Store, Shield, Truck, X, Home, ShoppingBag, Grid3X3, TrendingUp, Percent, Gavel, Sparkles, MessageCircle, HelpCircle, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { User as UserType } from "@/types";
import { Button } from "@/components/ui/button";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface MobileMenuProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  user: UserType | null;
  isAdmin: boolean;
  isVendor: boolean;
  isDriver: boolean;
  logout: () => Promise<void>;
}

const MobileMenu: React.FC<MobileMenuProps> = ({
  mobileMenuOpen,
  setMobileMenuOpen,
  user,
  isAdmin,
  isVendor,
  isDriver,
  logout,
}) => {

  const mainMenuItems = [
    { label: "Home", path: "/", icon: Home },
    { label: "Shop", path: "/shop", icon: ShoppingBag },
    { label: "Best Sellers", path: "/best-sellers", icon: TrendingUp },
    { label: "Deals", path: "/deals", icon: Percent },
    { label: "Auctions", path: "/auctions", icon: Gavel },
    { label: "New Arrivals", path: "/new-arrivals", icon: Sparkles },
  ];

  const supportMenuItems = [
    { label: "Contact", path: "/contact", icon: MessageCircle },
    { label: "FAQ", path: "/faq", icon: HelpCircle },
  ];

  return (
    <>
      {/* Dark overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300",
          mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />
      
      {/* Menu content */}
      <div className={cn(
        "md:hidden bg-white dark:bg-background border-l border-border shadow-lg fixed top-0 right-0 h-[100dvh] w-[80vw] max-w-[320px] z-50 overflow-y-auto overflow-x-hidden transition-transform duration-300",
        mobileMenuOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-background border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <span className="font-semibold text-foreground">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-4 py-4 space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              className="block w-full pl-10 pr-3 py-2.5 border border-input rounded-md text-sm bg-background placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search products..."
            />
          </div>

          {/* Main Navigation */}
          <div className="space-y-1">
            {mainMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Categories Section */}
          <Collapsible className="border-t border-border pt-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2.5 rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                Categories
              </div>
              <span className="text-muted-foreground text-xs">+</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 ml-7 space-y-3">
              <Link
                to="/categories"
                className="block px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                All Categories
              </Link>
              
              <div>
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clothing</p>
                <div className="space-y-1">
                  <Link
                    to="/category/clothing/men"
                    className="block px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Men's Clothing
                  </Link>
                  <Link
                    to="/category/clothing/women"
                    className="block px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Women's Clothing
                  </Link>
                  <Link
                    to="/category/clothing/kids"
                    className="block px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Kids' Clothing
                  </Link>
                </div>
              </div>
              
              <div>
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Home</p>
                <div className="space-y-1">
                  <Link
                    to="/category/home-kitchen/appliances"
                    className="block px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Appliances
                  </Link>
                  <Link
                    to="/category/home-kitchen/kitchen"
                    className="block px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Electronics
                  </Link>
                  <Link
                    to="/category/home-kitchen/furniture"
                    className="block px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Furniture
                  </Link>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Support Links */}
          <div className="border-t border-border pt-4 space-y-1">
            {supportMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Role-specific Links */}
          {(isVendor || isDriver || isAdmin || (user && !isVendor)) && (
            <div className="border-t border-border pt-4 space-y-1">
              {user?.role === 'consumer' && !isVendor && (
                <Link
                  to="/vendor/register"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Store className="h-4 w-4 text-muted-foreground" />
                  Become a Vendor
                </Link>
              )}
              {isVendor && (
                <Link
                  to="/vendor/dashboard"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Store className="h-4 w-4 text-muted-foreground" />
                  Vendor Dashboard
                </Link>
              )}
              {isDriver && (
                <Link
                  to="/driver/dashboard"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  Driver Dashboard
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin/dashboard"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Admin Dashboard
                </Link>
              )}
            </div>
          )}

          {/* User Section */}
          <div className="border-t border-border pt-4">
            {user ? (
              <div className="space-y-3">
                <div className="px-3 py-2 bg-muted/50 rounded-md">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.name || user.email}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  My Dashboard
                </Link>
                <button
                  onClick={async () => {
                    await logout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileMenu;
