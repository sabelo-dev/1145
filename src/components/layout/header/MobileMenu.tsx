import React from "react";
import { Link } from "react-router-dom";
import { Search, Store, Shield, Truck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { User as UserType } from "@/types";

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
        "md:hidden bg-background opacity-100 border-t border-border shadow-lg fixed top-0 right-0 h-full w-4/5 max-w-sm z-50 overflow-y-auto transition-transform duration-300",
        mobileMenuOpen ? "translate-x-0" : "translate-x-full"
      )}>
      <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-background opacity-100">
        {/* Close button */}
        <div className="flex justify-end items-center px-3 py-2">
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <Link
          to="/"
          className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setMobileMenuOpen(false)}
        >
          Home
        </Link>
        <Link
          to="/shop"
          className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setMobileMenuOpen(false)}
        >
          Shop
        </Link>
        
        {/* Categories with Subcategories */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">
            Categories
            <span className="text-xs">+</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 space-y-1">
            <Link
              to="/categories"
              className="block px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              All Categories
            </Link>
            <div className="pl-3">
              <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Clothing</p>
              <Link
                to="/category/clothing/men"
                className="block px-3 py-1 rounded-md text-sm text-gray-600 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Men's Clothing
              </Link>
              <Link
                to="/category/clothing/women"
                className="block px-3 py-1 rounded-md text-sm text-gray-600 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Women's Clothing
              </Link>
              <Link
                to="/category/clothing/kids"
                className="block px-3 py-1 rounded-md text-sm text-gray-600 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Kids' Clothing
              </Link>
            </div>
            <div className="pl-3">
              <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Home</p>
              <Link
                to="/category/home-kitchen/appliances"
                className="block px-3 py-1 rounded-md text-sm text-gray-600 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Appliances
              </Link>
              <Link
                to="/category/home-kitchen/kitchen"
                className="block px-3 py-1 rounded-md text-sm text-gray-600 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Electronics
              </Link>
              <Link
                to="/category/home-kitchen/furniture"
                className="block px-3 py-1 rounded-md text-sm text-gray-600 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Furniture
              </Link>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Link
          to="/best-sellers"
          className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setMobileMenuOpen(false)}
        >
          Best Sellers
        </Link>
        <Link
          to="/deals"
          className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setMobileMenuOpen(false)}
        >
          Deals
        </Link>
        <Link
          to="/auctions"
          className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setMobileMenuOpen(false)}
        >
          Auctions
        </Link>
        <Link
          to="/new-arrivals"
          className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setMobileMenuOpen(false)}
        >
          New Arrivals
        </Link>
        <Link
          to="/contact"
          className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setMobileMenuOpen(false)}
        >
          Contact
        </Link>
        <Link
          to="/faq"
          className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setMobileMenuOpen(false)}
        >
          FAQ
        </Link>

        {/* User-specific links */}
        {user?.role === 'consumer' && !isVendor && (
          <Link
            to="/vendor/register"
            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Store className="h-4 w-4 inline-block mr-2" />
            Become a Vendor
          </Link>
        )}
        {isVendor && (
          <Link
            to="/vendor/dashboard"
            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Store className="h-4 w-4 inline-block mr-2" />
            Vendor Dashboard
          </Link>
        )}
        {isDriver && (
          <Link
            to="/driver/dashboard"
            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Truck className="h-4 w-4 inline-block mr-2" />
            Driver Dashboard
          </Link>
        )}
        {isAdmin && (
          <Link
            to="/admin/dashboard"
            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Shield className="h-4 w-4 inline-block mr-2" />
            Admin Dashboard
          </Link>
        )}

        {/* Search Bar in Mobile Menu */}
        <div className="px-3 py-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="search"
              className="block w-full pl-10 pr-3 py-2 border border-input rounded-md leading-5 bg-background placeholder-muted-foreground focus:outline-none focus:ring-ring focus:border-ring sm:text-sm"
              placeholder="Search"
            />
          </div>
        </div>

        {/* User Actions in Mobile Menu */}
        {user ? (
          <div className="px-3 py-2">
            <div className="font-medium text-gray-800 mb-2">
              {user.name || user.email}
            </div>
            <Link
              to="/account"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              Account
            </Link>
            <button
              onClick={async () => {
                await logout();
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="px-3 py-2">
            <Link
              to="/login"
              className="block w-full text-center px-3 py-2 rounded-md bg-primary text-primary-foreground font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default MobileMenu;
