import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Home, ShoppingBag, Grid3X3, TrendingUp, Percent, Gavel, LogIn, User, Package, Settings, LogOut, Store, Truck, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const menuItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Shop", path: "/shop", icon: ShoppingBag },
  { label: "Categories", path: "/categories", icon: Grid3X3 },
  { label: "Best Sellers", path: "/best-sellers", icon: TrendingUp },
  { label: "Deals", path: "/deals", icon: Percent },
  { label: "Auctions", path: "/auctions", icon: Gavel },
];

const HomeNavMenu: React.FC = () => {
  const { user, logout, isVendor, isDriver } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  return (
    <nav className="bg-background border-b border-border sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-4 py-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">11</span>
            </div>
            <span className="font-bold text-lg text-foreground hidden md:inline">1145 Lifestyle</span>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 h-9 w-full"
              />
            </div>
          </form>

          {/* Nav Items */}
          <ul className="flex items-center gap-1 md:gap-2 overflow-x-auto flex-shrink-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap outline-none">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Profile</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/account" className="flex items-center gap-2 cursor-pointer">
                      <User className="h-4 w-4" />
                      My Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account?tab=orders" className="flex items-center gap-2 cursor-pointer">
                      <Package className="h-4 w-4" />
                      Orders
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account?tab=profile" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  
                  {(!isVendor || !isDriver) && <DropdownMenuSeparator />}
                  
                  {!isVendor && (
                    <DropdownMenuItem asChild>
                      <Link to="/vendor/register" className="flex items-center gap-2 cursor-pointer">
                        <Store className="h-4 w-4" />
                        Become a Vendor
                      </Link>
                    </DropdownMenuItem>
                  )}
                  
                  {!isDriver && (
                    <DropdownMenuItem asChild>
                      <Link to="/driver/register" className="flex items-center gap-2 cursor-pointer">
                        <Truck className="h-4 w-4" />
                        Become a Driver
                      </Link>
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => logout()} 
                    className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
            )}
          </li>
        </ul>
        </div>
      </div>
    </nav>
  );
};

export default HomeNavMenu;
