import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Home, ShoppingBag, Grid3X3, ShoppingCart, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";

const items = [
  { label: "Home", path: "/", icon: Home },
  { label: "Shop", path: "/shop", icon: ShoppingBag },
  { label: "Browse", path: "/categories", icon: Grid3X3 },
] as const;

const MobileBottomNav: React.FC = () => {
  const { user } = useAuth();
  const { cart, toggleCart } = useCart();
  const navigate = useNavigate();
  const count = cart?.items?.length || 0;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary mobile navigation"
    >
      <ul className="grid grid-cols-5 h-14">
        {items.map(({ label, path, icon: Icon }) => (
          <li key={path} className="flex">
            <NavLink
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:scale-95 ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}

        <li className="flex">
          <button
            type="button"
            onClick={toggleCart}
            aria-label={`Cart, ${count} items`}
            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground active:scale-95"
          >
            <ShoppingCart className="h-5 w-5" />
            <span>Cart</span>
            {count > 0 && (
              <span className="absolute top-1 right-4 min-w-[16px] h-4 px-1 bg-primary text-primary-foreground rounded-full text-[9px] flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
        </li>

        <li className="flex">
          <button
            type="button"
            onClick={() => navigate(user ? "/dashboard" : "/login")}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground active:scale-95"
          >
            <User className="h-5 w-5" />
            <span>{user ? "Account" : "Sign in"}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
