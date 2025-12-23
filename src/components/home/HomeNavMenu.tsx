import React from "react";
import { Link } from "react-router-dom";
import { Home, ShoppingBag, Grid3X3, TrendingUp, Percent, Gavel } from "lucide-react";

const menuItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Shop", path: "/shop", icon: ShoppingBag },
  { label: "Categories", path: "/categories", icon: Grid3X3 },
  { label: "Best Sellers", path: "/best-sellers", icon: TrendingUp },
  { label: "Deals", path: "/deals", icon: Percent },
  { label: "Auctions", path: "/auctions", icon: Gavel },
];

const HomeNavMenu: React.FC = () => {
  return (
    <nav className="bg-background border-b border-border sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <ul className="flex items-center justify-center gap-2 md:gap-8 py-3 overflow-x-auto">
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
        </ul>
      </div>
    </nav>
  );
};

export default HomeNavMenu;
