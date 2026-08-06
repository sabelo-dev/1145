import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Home, ShoppingBag, Grid3X3, ShoppingCart, User } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";

const items = [
  { label: "Home", path: "/", icon: Home },
  { label: "Shop", path: "/shop", icon: ShoppingBag },
  { label: "Browse", path: "/categories", icon: Grid3X3 },
] as const;

const tap = () => {
  // Light haptic feedback where supported (Android / PWA)
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate?.(8); } catch { /* noop */ }
  }
};

const itemClass =
  "relative flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-tight transition-colors duration-200";

const MobileBottomNav: React.FC = () => {
  const { user } = useAuth();
  const { cart, toggleCart } = useCart();
  const navigate = useNavigate();
  const count = cart?.items?.length || 0;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/70 bg-background/80 backdrop-blur-2xl backdrop-saturate-150"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary mobile navigation"
    >
      <ul className="grid grid-cols-5" style={{ height: "var(--bottom-nav-h)" }}>
        {items.map(({ label, path, icon: Icon }) => (
          <li key={path} className="flex">
            <NavLink
              to={path}
              end={path === "/"}
              onClick={tap}
              className={({ isActive }) =>
                `${itemClass} ${isActive ? "text-foreground" : "text-muted-foreground"}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="bottom-nav-indicator"
                      transition={{ type: "spring", stiffness: 480, damping: 36 }}
                      className="absolute inset-x-4 top-1 h-9 rounded-full bg-secondary"
                    />
                  )}
                  <span className="relative flex flex-col items-center gap-1">
                    <Icon
                      className={`h-[22px] w-[22px] transition-transform duration-200 ${
                        isActive ? "stroke-[2.4] -translate-y-px" : ""
                      }`}
                    />
                    <span>{label}</span>
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}

        <li className="flex">
          <button
            type="button"
            onClick={() => { tap(); toggleCart(); }}
            aria-label={`Cart, ${count} items`}
            className={`${itemClass} text-muted-foreground active:scale-95`}
          >
            <span className="relative flex flex-col items-center gap-1">
              <span className="relative">
                <ShoppingCart className="h-[22px] w-[22px]" />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 bg-accent text-accent-foreground rounded-full text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
              <span>Cart</span>
            </span>
          </button>
        </li>

        <li className="flex">
          <button
            type="button"
            onClick={() => { tap(); navigate(user ? "/dashboard" : "/login"); }}
            className={`${itemClass} text-muted-foreground active:scale-95`}
          >
            <span className="relative flex flex-col items-center gap-1">
              <User className="h-[22px] w-[22px]" />
              <span>{user ? "Account" : "Sign in"}</span>
            </span>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
