import React from "react";
import { cn } from "@/lib/utils";
import { ROUTE_STATUS, SHIPMENT_STATUS, type RouteStatus, type ShipmentStatus } from "../lib/db";

export const FullScreenSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent", className)} />
);

export const ShipmentStatusBadge: React.FC<{ status: ShipmentStatus; className?: string }> = ({ status, className }) => {
  const s = SHIPMENT_STATUS[status] ?? SHIPMENT_STATUS.created;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", s.tone, className)}>
      {s.label}
    </span>
  );
};

export const RouteStatusBadge: React.FC<{ status: RouteStatus; className?: string }> = ({ status, className }) => {
  const s = ROUTE_STATUS[status] ?? ROUTE_STATUS.draft;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", s.tone, className)}>
      {s.label}
    </span>
  );
};

export const PageHeader: React.FC<{ title: string; description?: string; actions?: React.ReactNode }> = ({
  title,
  description,
  actions,
}) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "warn" | "danger" | "good";
}> = ({ label, value, hint, icon, tone = "default" }) => (
  <div className="rounded-xl border bg-card p-4">
    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      {icon}
    </div>
    <div
      className={cn(
        "mt-2 text-2xl font-semibold tabular-nums",
        tone === "warn" && "text-amber-600 dark:text-amber-400",
        tone === "danger" && "text-red-600 dark:text-red-400",
        tone === "good" && "text-emerald-600 dark:text-emerald-400",
      )}
    >
      {value}
    </div>
    {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-xl border border-dashed">
    {icon && <div className="text-muted-foreground mb-3">{icon}</div>}
    <p className="font-medium">{title}</p>
    {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
