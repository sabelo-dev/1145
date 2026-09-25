import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown, Gavel, Grid3X3, LayoutDashboard, Percent, LogOut, Menu, Package, Search, Settings,
  ShoppingCart, Sparkles, Store, TrendingUp, Truck, User, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CartSheet from "@/components/shop/CartSheet";
import MobileMenu from "./header/MobileMenu";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { CurrencyToggle } from "@/components/gold";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Primary destinations, always visible from md up. */
const primaryNav = [
  { label: "Shop", path: "/shop" },
  { label: "Marketplace", path: "/store/marketplace" },
  { label: "Services", path: "/services" },
  // Tablets (md) move these into "More" so the bar never collides.
  { label: "Deals", path: "/deals", wideOnly: true },
  { label: "Auctions", path: "/auctions", wideOnly: true },
];

/** Secondary destinations, grouped under "More" so the bar never overflows. */
const moreNav = [
  { label: "Deals", path: "/deals", icon: Percent, narrowOnly: true },
  { label: "Auctions", path: "/auctions", icon: Gavel, narrowOnly: true },
  { label: "Categories", path: "/categories", icon: Grid3X3 },
  { label: "Best sellers", path: "/best-sellers", icon: TrendingUp },
  { label: "New arrivals", path: "/new-arrivals", icon: Sparkles },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative inline-flex h-9 items-center rounded-full px-3 text-sm font-medium transition-colors whitespace-nowrap",
    isActive
      ? "bg-foreground text-background"
      : "text-foreground/80 hover:bg-surface-hover hover:text-foreground",
  );

const iconButton =
  "h-10 w-10 rounded-full press text-foreground hover:bg-surface-hover hover:text-foreground active:bg-surface-pressed";

const Header: React.FC = () => {
  const { user, logout, isMerchant, isDriver, isAdmin, isInfluencer } = useAuth();
  const { cart, toggleCart, isCartOpen, setCartOpen } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const itemCount = (cart?.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
  const moreActive = moreNav.some((item) => location.pathname.startsWith(item.path));
  const dashboardPath = isAdmin
    ? "/admin/dashboard"
    : isInfluencer
      ? "/influencer/dashboard"
      : isDriver
        ? "/driver/dashboard"
        : isMerchant
          ? "/merchant/dashboard"
          : "/dashboard";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Close the search bar when navigating.
  useEffect(() => setSearchOpen(false), [location.pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/shop?search=${encodeURIComponent(q)}`);
    setSearchQuery("");
    setSearchOpen(false);
  };

  return (
    <>
      <header
        className={cn(
          "app-bar transition-[box-shadow,border-color] duration-300",
          isScrolled ? "border-b border-border shadow-soft" : "border-b border-transparent",
        )}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6 md:h-16 lg:px-8">
          {/* Brand */}
          <Link to="/" className="flex shrink-0 items-center gap-2 rounded-xl" aria-label="1145 home">
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-xl shadow-soft" />
            <span className="hidden font-display text-lg font-bold tracking-tight sm:inline">1145</span>
          </Link>

          {/* Primary navigation (md+) */}
          <nav aria-label="Main" className="ml-2 hidden min-w-0 md:block lg:ml-4">
            <ul className="flex items-center gap-0.5">
              {primaryNav.map((item) => (
                <li key={item.path} className={item.wideOnly ? "hidden lg:block" : undefined}>
                  <NavLink to={item.path} className={navLinkClass}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(
                      navLinkClass({ isActive: moreActive }),
                      "gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    More <ChevronDown className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    {moreNav.map(({ label, path, icon: Icon, narrowOnly }) => (
                      <DropdownMenuItem key={path} asChild className={narrowOnly ? "lg:hidden" : undefined}>
                        <Link to={path} className="flex cursor-pointer items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            </ul>
          </nav>

          <div className="flex-1" />

          {/* Inline search (xl+) */}
          <form onSubmit={handleSearch} className="hidden w-72 xl:block" role="search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search 1145"
                aria-label="Search products"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-full border-transparent bg-surface-input pl-10 pr-4 text-sm focus-visible:border-input"
              />
            </div>
          </form>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn(iconButton, "xl:hidden")}
              onClick={() => setSearchOpen((open) => !open)}
              aria-label={searchOpen ? "Close search" : "Search"}
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" />}
            </Button>

            <div className="hidden xl:block">
              <CurrencyToggle compact />
            </div>

            {user && <NotificationCenter />}

            <Button
              onClick={toggleCart}
              variant="ghost"
              size="icon"
              className={cn(iconButton, "relative")}
              aria-label={itemCount ? `Cart, ${itemCount} items` : "Cart"}
            >
              <ShoppingCart className="h-[18px] w-[18px]" />
              {itemCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-brand-foreground ring-2 ring-background">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Button>

            {/* Account (md+) */}
            <div className="hidden md:block">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="ml-1 flex h-10 items-center gap-2 rounded-full border border-border pl-1 pr-3 text-sm font-medium outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Account menu"
                  >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
                        {(user.name || user.email || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="hidden max-w-[8rem] truncate lg:inline">{user.name?.split(" ")[0] || "Account"}</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <p className="truncate text-sm font-semibold">{user.name || "My account"}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to={dashboardPath} className="flex cursor-pointer items-center gap-2">
                        <LayoutDashboard className="h-4 w-4" /> Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard?tab=orders" className="flex cursor-pointer items-center gap-2">
                        <Package className="h-4 w-4" /> Orders
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard?tab=settings" className="flex cursor-pointer items-center gap-2">
                        <Settings className="h-4 w-4" /> Settings
                      </Link>
                    </DropdownMenuItem>
                    {(!isMerchant || !isDriver) && <DropdownMenuSeparator />}
                    {!isMerchant && (
                      <DropdownMenuItem asChild>
                        <Link to="/merchant/register" className="flex cursor-pointer items-center gap-2">
                          <Store className="h-4 w-4" /> Sell on 1145
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {!isDriver && (
                      <DropdownMenuItem asChild>
                        <Link to="/driver/register" className="flex cursor-pointer items-center gap-2">
                          <Truck className="h-4 w-4" /> Drive with 1145
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logout()}
                      className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="ml-1 flex items-center gap-1">
                  <Link
                    to="/login"
                    className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-foreground/80 transition-colors hover:bg-surface-hover hover:text-foreground lg:inline-flex"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    className="hidden h-10 items-center rounded-full bg-cta px-4 text-sm font-semibold text-cta-foreground transition-colors hover:bg-brand-hover lg:inline-flex"
                  >
                    Sign up
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-cta px-4 text-sm font-semibold text-cta-foreground transition-colors hover:bg-brand-hover lg:hidden"
                  >
                    <User className="h-4 w-4" /> Sign in
                  </Link>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className={cn(iconButton, "md:hidden")}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-[18px] w-[18px]" />
            </Button>
          </div>
        </div>

        {/* Expanding search (below xl) */}
        {searchOpen && (
          <div className="mx-auto max-w-7xl px-4 pb-3 animate-fade-in sm:px-6 xl:hidden lg:px-8">
            <form onSubmit={handleSearch} role="search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search products, stores and services"
                  aria-label="Search products"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-full rounded-full border-transparent bg-surface-input pl-10 pr-4 focus-visible:border-input"
                />
              </div>
            </form>
          </div>
        )}
      </header>

      <MobileMenu
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        user={user}
        isAdmin={isAdmin}
        isMerchant={isMerchant}
        isDriver={isDriver}
        logout={logout}
      />

      <CartSheet isOpen={isCartOpen} setIsOpen={setCartOpen} />
    </>
  );
};

export default Header;
