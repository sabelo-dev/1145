import React, { useState } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import PanicButton from "@/components/emergency/PanicButton";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import DriverOverview from "./DriverOverview";
import DriverAvailableJobs from "./DriverAvailableJobs";
import DriverActiveDeliveries from "./DriverActiveDeliveries";
import DriverAnalytics from "./DriverAnalytics";
import DriverSettings from "./DriverSettings";
import DriverVerification from "./DriverVerification";
import DriverLiveTracking from "./DriverLiveTracking";
import DriverJobMatching from "./DriverJobMatching";
import DriverRideRequests from "./DriverRideRequests";
import DriverRideHistory from "./DriverRideHistory";
import DriverRideAnalytics from "./DriverRideAnalytics";
import { UCoinDashboard } from "@/components/ucoin/UCoinDashboard";
import ZoneComplianceIndicator from "./ZoneComplianceIndicator";
import {
  LayoutDashboard,
  Truck,
  MapPin,
  BarChart3,
  Settings,
  LogOut,
  User,
  Shield,
  Navigation,
  Target,
  Coins,
  Car,
  History,
  PieChart,
  MapPinned,
} from "lucide-react";

interface Driver {
  id: string;
  name: string;
  status: string;
  rating: number;
  total_deliveries: number;
  phone: string | null;
  vehicle_type: string | null;
  license_number: string | null;
  vehicle_registration: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_color: string | null;
  vehicle_photo_url: string | null;
}

const SIDEBAR_ITEMS = [
  { id: "overview", title: "Overview", icon: LayoutDashboard },
  { id: "ride-requests", title: "Ride Requests", icon: Car },
  { id: "ride-history", title: "Ride History", icon: History },
  { id: "ride-analytics", title: "Ride Analytics", icon: PieChart },
  { id: "smart-matching", title: "Smart Matching", icon: Target },
  { id: "available-jobs", title: "Available Jobs", icon: MapPin },
  { id: "active-deliveries", title: "Active Deliveries", icon: Truck },
  { id: "live-tracking", title: "Live Tracking", icon: Navigation },
  { id: "zone-compliance", title: "Zone Compliance", icon: MapPinned },
  { id: "ucoin", title: "UCoin Rewards", icon: Coins },
  { id: "analytics", title: "My Analytics", icon: BarChart3 },
  { id: "verification", title: "Verification", icon: Shield },
  { id: "settings", title: "Settings", icon: Settings },
];

const DriverDashboard: React.FC = () => {
  const { user, isReady } = useAuthReady();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: driver, isLoading: driverLoading, refetch } = useQuery({
    queryKey: ["driver-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Driver | null;
    },
    enabled: isReady && !!user,
    staleTime: 30_000,
  });

  if (!isReady) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (driverLoading) {
    return <DashboardSkeleton />;
  }

  const handleLogout = async () => {
    try { await logout(); } catch (e) { console.error(e); }
  };

  return (
    <SidebarProvider>
      <DashboardShell
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        driver={driver}
        onLogout={handleLogout}
        onRefresh={() => refetch()}
      />
    </SidebarProvider>
  );
};

function DashboardSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-4 p-6">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
        <div className="grid grid-cols-2 gap-3 mt-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      </div>
    </div>
  );
}

interface DashboardShellProps {
  activeTab: string;
  setActiveTab: (id: string) => void;
  user: any;
  driver: Driver | null;
  onLogout: () => void;
  onRefresh: () => void;
}

const DashboardShell: React.FC<DashboardShellProps> = ({
  activeTab,
  setActiveTab,
  user,
  driver,
  onLogout,
  onRefresh,
}) => {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleItemClick = (id: string) => {
    setActiveTab(id);
    if (isMobile) setOpenMobile(false);
  };

  const statusColor = driver ? ({
    available: "bg-green-500",
    busy: "bg-amber-500",
    offline: "bg-gray-500",
    pending: "bg-blue-500",
  }[driver.status] || "bg-gray-500") : "bg-gray-500";

  return (
    <div className="min-h-screen flex w-full bg-background">
      <Sidebar className="border-r">
        <SidebarHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            <span className="font-semibold text-foreground">Driver Hub</span>
          </div>
          {driver && (
            <div className="mt-3 flex items-center gap-2">
              <Badge className={`${statusColor} text-white border-0`}>
                {driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                ⭐ {driver.rating?.toFixed(1) || "5.0"}
              </span>
            </div>
          )}
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {SIDEBAR_ITEMS.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  onClick={() => handleItemClick(item.id)}
                  isActive={activeTab === item.id}
                  className="w-full justify-start"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="flex-1">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <h1 className="text-lg font-semibold text-foreground">
              {SIDEBAR_ITEMS.find((i) => i.id === activeTab)?.title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {driver && (
              <PanicButton
                userId={user.id}
                role="driver"
                className="scale-75"
              />
            )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" alt={driver?.name || "Driver"} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {driver?.name?.charAt(0)?.toUpperCase() || "D"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-medium leading-none">{driver?.name || "Driver"}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                {driver && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {driver.total_deliveries} deliveries
                  </p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleItemClick("settings")}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 bg-background overflow-auto">
          <TabContent activeTab={activeTab} driver={driver} onRefresh={onRefresh} />
        </main>
      </SidebarInset>
    </div>
  );
};

interface TabContentProps {
  activeTab: string;
  driver: Driver | null;
  onRefresh: () => void;
}

const TabContent: React.FC<TabContentProps> = ({ activeTab, driver, onRefresh }) => {
  switch (activeTab) {
    case "overview":
      return <DriverOverview driver={driver} onRefresh={onRefresh} />;
    case "ride-requests":
      return <DriverRideRequests driver={driver} onRideAccepted={onRefresh} />;
    case "ride-history":
      return <DriverRideHistory driver={driver} />;
    case "ride-analytics":
      return <DriverRideAnalytics driver={driver} />;
    case "smart-matching":
      return <DriverJobMatching driver={driver} onJobClaimed={onRefresh} />;
    case "available-jobs":
      return <DriverAvailableJobs driver={driver} onJobClaimed={onRefresh} />;
    case "active-deliveries":
      return <DriverActiveDeliveries driver={driver} onStatusUpdate={onRefresh} />;
    case "live-tracking":
      return <DriverLiveTracking driver={driver} />;
    case "zone-compliance":
      return <ZoneComplianceIndicator driverId={driver?.id || ""} currentLat={null} currentLng={null} />;
    case "ucoin":
      return <UCoinDashboard />;
    case "analytics":
      return <DriverAnalytics driver={driver} />;
    case "verification":
      return <DriverVerification driver={driver} />;
    case "settings":
      return <DriverSettings driver={driver} onUpdate={onRefresh} />;
    default:
      return <DriverOverview driver={driver} onRefresh={onRefresh} />;
  }
};

export default DriverDashboard;
