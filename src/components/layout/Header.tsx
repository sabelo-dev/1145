import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Home, ShoppingBag, Grid3X3, TrendingUp, Percent, Gavel, LogIn, User, Package, Settings, LogOut, Store, Truck, Search, X, ShoppingCart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CartSheet from "@/components/shop/CartSheet";
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

const Header: React.FC = () => {
  const { user, logout, isVendor, isDriver } = useAuth();
  const { cart, toggleCart, isCartOpen, setCartOpen } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const items = cart?.items || [];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (mobileSearchOpen && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [mobileSearchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setMobileSearchOpen(false);
    }
  };

  return (
    <>
      <header 
        className={`bg-background sticky top-0 z-40 transition-all duration-300 ease-in-out ${
          isScrolled 
            ? "border-b border-border shadow-sm" 
            : "border-b border-transparent"
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-3 py-2">
            {/* Logo */}
            <Link to="/" className="flex-shrink-0">
              <div className="px-2.5 py-1 bg-primary rounded-md flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">1145</span>
              </div>
            </Link>

            {/* Desktop Search Bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-md hidden sm:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 h-8 w-full text-sm"
                />
              </div>
            </form>

            {/* Mobile Search Button */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden flex-shrink-0 h-8 w-8"
              onClick={() => setMobileSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Nav Items */}
            <ul className="flex items-center gap-1 md:gap-2 overflow-x-auto flex-shrink-0">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{item.label}</span>
                    </Link>
                  </li>
                );
              })}

              {/* Cart Button */}
              <li>
                <Button 
                  onClick={toggleCart} 
                  variant="ghost" 
                  size="sm"
                  className="relative h-8 px-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {items.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center">
                      {items.length}
                    </span>
                  )}
                </Button>
              </li>

              {/* Profile/Sign In */}
              <li>
                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap outline-none">
                      <User className="h-3.5 w-3.5" />
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
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Sign In</span>
                  </Link>
                )}
              </li>
            </ul>
          </div>

          {/* Mobile Search Bar - Full Width */}
          {mobileSearchOpen && (
            <div className="sm:hidden pb-2 animate-fade-in">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={mobileInputRef}
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 h-9 w-full"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    setMobileSearchOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Cart Offcanvas */}
      <CartSheet isOpen={isCartOpen} setIsOpen={setCartOpen} />
    </>
  );
};

export default Header;
