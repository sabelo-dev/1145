import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Radar,
  Route as RouteIcon,
  Warehouse,
  Truck,
  Users,
  UserCog,
  LogOut,
  Menu,
  X,
  Search,
  ScanLine,
  BarChart3,
  Code2,
  ShieldCheck,
  Banknote,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { ROLE_LABELS, type LogisticsRole } from "../lib/db";

const NAV: Array<{ to: string; label: string; icon: React.ElementType; roles?: LogisticsRole[] }> = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/shipments", label: "Shipments", icon: Package },
  { to: "/dispatch", label: "Dispatch", icon: Radar },
  { to: "/routes", label: "Routes", icon: RouteIcon },
  { to: "/scan", label: "Scan station", icon: ScanLine },
  { to: "/hubs", label: "Hubs", icon: Warehouse },
  { to: "/fleet", label: "Fleet", icon: Truck },
  { to: "/drivers", label: "Drivers", icon: Users },
  { to: "/cod", label: "Cash on delivery", icon: Banknote },
  { to: "/accounts", label: "Business accounts", icon: Building2, roles: ["owner"] },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/team", label: "Team", icon: UserCog, roles: ["owner"] },
  { to: "/developers", label: "Developers", icon: Code2, roles: ["owner"] },
  { to: "/security", label: "Security", icon: ShieldCheck },
];

const LogisticsLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, session, signOut } = useLogisticsAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const items = NAV.filter((n) => !n.roles || (role && n.roles.includes(role)));

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r bg-background">
        <Brand />
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <UserFooter email={session?.user.email} role={role} onSignOut={signOut} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 flex flex-col bg-background border-r">
            <div className="flex items-center justify-between pr-2">
              <Brand />
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <UserFooter email={session?.user.email} role={role} onSignOut={signOut} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 backdrop-blur px-4 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <QuickTrack onFind={(tn) => navigate(`/shipments?q=${encodeURIComponent(tn)}`)} />
        </header>
        <main className="p-4 sm:p-6 max-w-[1400px] mx-auto">{children}</main>
      </div>
    </div>
  );
};

const Brand = () => (
  <div className="flex items-center gap-2 px-5 h-14 border-b lg:border-b">
    <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-bold">LX</div>
    <div className="leading-tight">
      <div className="text-sm font-semibold">1145 Logistics</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Operations</div>
    </div>
  </div>
);

const UserFooter: React.FC<{ email?: string; role: LogisticsRole | null; onSignOut: () => void }> = ({ email, role, onSignOut }) => (
  <div className="border-t p-3">
    <div className="px-2 pb-2">
      <div className="text-sm font-medium truncate">{email}</div>
      {role && <div className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</div>}
    </div>
    <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onSignOut}>
      <LogOut className="h-4 w-4" /> Sign out
    </Button>
  </div>
);

const QuickTrack: React.FC<{ onFind: (tn: string) => void }> = ({ onFind }) => {
  const [value, setValue] = useState("");
  return (
    <form
      className="relative flex-1 max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onFind(value.trim().toUpperCase());
      }}
    >
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Find tracking number, recipient or reference…"
        className="h-9 w-full rounded-lg border bg-muted/40 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </form>
  );
};

export default LogisticsLayout;
