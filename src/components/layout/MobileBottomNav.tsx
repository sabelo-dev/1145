import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  CarFront,
  Grid2x2,
  House,
  UserRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const items: Array<{
  label: string;
  path: string;
  icon: LucideIcon;
  authRequired?: boolean;
  exact?: boolean;
}> = [
  { label: "Home", path: "/", icon: House, exact: true },
  { label: "Services", path: "/services", icon: Grid2x2 },
  { label: "Ride", path: "/rides/request", icon: CarFront },
  { label: "Wallet", path: "/wallet", icon: WalletCards, authRequired: true },
  { label: "Account", path: "/dashboard", icon: UserRound, authRequired: true },
] as const;

const tap = () => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate?.(8);
    } catch {
      // noop
    }
  }
};

const itemClass =
  "relative flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-tight transition-all duration-200 focus-visible:outline-none";

const MobileBottomNav: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleItemNavigate = (path: string, authRequired?: boolean) => {
    tap();
    if (authRequired && !user) {
      navigate("/login", { replace: false });
      return;
    }
    navigate(path);
  };

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/85 shadow-[0_-16px_40px_-24px_rgba(15,23,42,0.5)] backdrop-blur-2xl backdrop-saturate-150"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.12rem)" }}
      aria-label="Primary mobile navigation"
    >
      <ul className="grid grid-cols-5" style={{ height: "calc(var(--bottom-nav-h) + 0.2rem)" }}>
        {items.map(({ label, path, icon: Icon, authRequired, exact }) => (
          <li key={path} className="flex min-w-0">
            <NavLink
              to={path}
              end={exact}
              onClick={(event) => {
                if (authRequired && !user) {
                  event.preventDefault();
                  handleItemNavigate(path, authRequired);
                  return;
                }
                tap();
              }}
              className={({ isActive }) =>
                `${itemClass} ${isActive ? "text-brand font-semibold" : "text-text-secondary hover:text-brand active:text-brand"}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="bottom-nav-indicator"
                      transition={{ type: "spring", stiffness: 480, damping: 36 }}
                      className="absolute inset-x-2 top-1 h-10 rounded-2xl bg-surface-selected shadow-sm ring-1 ring-border/60"
                    />
                  )}

                  <span className="relative flex flex-col items-center justify-center gap-1.5">
                    <Icon
                      className={`h-[21px] w-[21px] transition-all duration-200 ${
                        isActive ? "stroke-[2.4] text-brand -translate-y-px" : ""
                      }`}
                    />
                    <span className="leading-none">{label}</span>
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
