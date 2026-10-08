import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase, Building2, Car, CircleHelp, Gavel, Grid2x2, Grid3X3, LayoutDashboard, LogOut, MessageCircle, PackageSearch, Percent, Search,
  Shield, ShoppingBag, ShoppingCart, Sparkles, Store, TrendingUp, Truck, UtensilsCrossed, Wallet, type LucideIcon,
} from "lucide-react";
import { User as UserType } from "@/types";
import { useCart } from "@/contexts/CartContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OFFICIAL_STORE_PATH } from "@/lib/officialStore";
import { CurrencyToggle } from "@/components/gold";

interface MobileMenuProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  user: UserType | null;
  isAdmin: boolean;
  isMerchant: boolean;
  isDriver: boolean;
  logout: () => Promise<void>;
}

type Item = { label: string; path: string; icon: LucideIcon };

/** Same destinations as the desktop bar and its "More" menu. */
const shopItems: Item[] = [
  { label: "Get a ride", path: "/rides/request", icon: Car },
  { label: "Shop", path: "/shop", icon: ShoppingBag },
  { label: "Marketplace", path: OFFICIAL_STORE_PATH, icon: Store },
  { label: "Hire a pro", path: "/hire", icon: Briefcase },
  { label: "Food delivery", path: "/food", icon: UtensilsCrossed },
  { label: "Stays", path: "/stays", icon: Building2 },
  { label: "All services", path: "/services", icon: Grid2x2 },
  { label: "Deals", path: "/deals", icon: Percent },
  { label: "Auctions", path: "/auctions", icon: Gavel },
  { label: "Categories", path: "/categories", icon: Grid3X3 },
  { label: "Best sellers", path: "/best-sellers", icon: TrendingUp },
  { label: "New arrivals", path: "/new-arrivals", icon: Sparkles },
];

const helpItems: Item[] = [
  { label: "Track an order", path: "/track-order", icon: PackageSearch },
  { label: "Contact", path: "/contact", icon: MessageCircle },
  { label: "FAQ", path: "/faq", icon: CircleHelp },
];

const rowClass =
  "flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium text-foreground transition-colors hover:bg-surface-hover active:bg-surface-pressed";

const MobileMenu: React.FC<MobileMenuProps> = ({
  mobileMenuOpen, setMobileMenuOpen, user, isAdmin, isMerchant, isDriver, logout,
}) => {
  const navigate = useNavigate();
  const { cart, setCartOpen } = useCart();
  const [query, setQuery] = useState("");
  const close = () => setMobileMenuOpen(false);
  const itemCount = (cart?.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/shop?search=${encodeURIComponent(q)}`);
    setQuery("");
    close();
  };

  const roleItems: Item[] = [
    ...(isAdmin ? [{ label: "Admin dashboard", path: "/admin/dashboard", icon: Shield }] : []),
    ...(isMerchant ? [{ label: "Merchant dashboard", path: "/merchant/dashboard", icon: Store }] : []),
    ...(isDriver ? [{ label: "Driver dashboard", path: "/driver/dashboard", icon: Truck }] : []),
    ...(user && !isMerchant ? [{ label: "Sell on 1145", path: "/merchant/register", icon: Store }] : []),
    ...(user && !isDriver ? [{ label: "Drive with 1145", path: "/driver/register", icon: Truck }] : []),
  ];

  const renderItems = (items: Item[]) => (
    <ul>
      {items.map(({ label, path, icon: Icon }) => (
        <li key={path + label}>
          <Link to={path} onClick={close} className={rowClass}>
            <Icon className="h-[18px] w-[18px] shrink-0 text-text-secondary" aria-hidden />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    // Radix dialog: traps focus, closes on Escape and returns focus to the menu button.
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetContent side="right" className="flex w-[86vw] max-w-sm flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-lg">Menu</SheetTitle>
          <SheetDescription className="sr-only">Site navigation, search, cart and account</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4 safe-bottom">
          <form onSubmit={handleSearch} role="search" className="relative px-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products and stores"
              aria-label="Search products"
              className="h-12 w-full rounded-full border border-transparent bg-surface-input pl-10 pr-4 text-base text-foreground placeholder:text-text-secondary focus:border-input focus:bg-background focus:outline-none"
            />
          </form>

          <nav aria-label="Shop and services">{renderItems(shopItems)}</nav>

          <nav aria-label="Help" className="border-t border-border pt-4">{renderItems(helpItems)}</nav>

          <div className="border-t border-border px-3 pt-4">
            <CurrencyToggle className="justify-between" />
          </div>

          <div className="border-t border-border pt-4">
            <button type="button" className={rowClass} onClick={() => { close(); setCartOpen(true); }}>
              <ShoppingCart className="h-[18px] w-[18px] shrink-0 text-text-secondary" aria-hidden />
              <span className="flex-1">Cart</span>
              {itemCount > 0 && (
                <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold tabular-nums text-brand-foreground">
                  {itemCount > 99 ? "99+" : itemCount}
                  <span className="sr-only"> items</span>
                </span>
              )}
            </button>

            {user ? (
              <>
                <div className="mx-1 my-2 rounded-xl bg-surface-muted px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-foreground">{user.name || user.email}</p>
                  {user.name && <p className="truncate text-xs text-text-secondary">{user.email}</p>}
                </div>
                {renderItems([{ label: "My account", path: "/dashboard", icon: LayoutDashboard }, { label: "Wallet", path: "/wallet", icon: Wallet }, ...roleItems])}
                <button
                  type="button"
                  onClick={async () => { await logout(); close(); }}
                  className={`${rowClass} text-destructive hover:bg-destructive/10`}
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  Sign out
                </button>
              </>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 px-1">
                <Link
                  to="/login"
                  onClick={close}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-border text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  onClick={close}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-cta text-sm font-semibold text-cta-foreground transition-colors hover:bg-brand-hover"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenu;
