import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { supabase } from "@/integrations/supabase/client";
import DriverOverview from "./DriverOverview";
import DriverAvailableJobs from "./DriverAvailableJobs";
import DriverActiveDeliveries from "./DriverActiveDeliveries";
import DriverAnalytics from "./DriverAnalytics";
import DriverSettings from "./DriverSettings";
import DriverVerification from "./DriverVerification";
import DriverLiveTracking from "./DriverLiveTracking";
import DriverJobMatching from "./DriverJobMatching";
import {
  LayoutDashboard,
  Truck,
  Package,
  BarChart3,
  Settings,
  LogOut,
  User,
  MapPin,
  Shield,
  Navigation,
  Target,
  Coins,
} from "lucide-react";
import { UCoinDashboard } from "@/components/ucoin/UCoinDashboard";

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
}

const DriverDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [driver, setDriver] = useState<Driver | null>(null);

  useEffect(() => {
    if (user) {
      fetchDriverInfo();
    }
  }, [user]);

  const fetchDriverInfo = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!error && data) {
      setDriver(data);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-500";
      case "busy":
        return "bg-amber-500";
      case "offline":
        return "bg-gray-500";
      case "pending":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const sidebarItems = [
    { id: "overview", title: "Overview", icon: LayoutDashboard },
    { id: "smart-matching", title: "Smart Matching", icon: Target },
    { id: "available-jobs", title: "Available Jobs", icon: MapPin },
    { id: "active-deliveries", title: "Active Deliveries", icon: Truck },
    { id: "live-tracking", title: "Live Tracking", icon: Navigation },
    { id: "ucoin", title: "UCoin Rewards", icon: Coins },
    { id: "analytics", title: "My Analytics", icon: BarChart3 },
    { id: "verification", title: "Verification", icon: Shield },
    { id: "settings", title: "Settings", icon: Settings },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar className="border-r">
          <SidebarHeader className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">Driver Dashboard</span>
            </div>
            {driver && (
              <div className="mt-3 flex items-center gap-2">
                <Badge className={`${getStatusColor(driver.status)} text-white`}>
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
              {sidebarItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => setActiveTab(item.id)}
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
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <h1 className="text-lg font-semibold text-foreground">
                {sidebarItems.find((item) => item.id === activeTab)?.title}
              </h1>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar_url || ""} alt={driver?.name || "Driver"} />
                    <AvatarFallback>
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
                    <p className="text-xs text-muted-foreground">
                      {driver.total_deliveries} deliveries completed
                    </p>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveTab("settings")}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 p-6 bg-background">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
              <TabsList className="hidden">
                {sidebarItems.map((item) => (
                  <TabsTrigger key={item.id} value={item.id}>
                    {item.title}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="mt-0">
                <DriverOverview driver={driver} onRefresh={fetchDriverInfo} />
              </TabsContent>
              <TabsContent value="smart-matching" className="mt-0">
                <DriverJobMatching driver={driver} onJobClaimed={fetchDriverInfo} />
              </TabsContent>
              <TabsContent value="available-jobs" className="mt-0">
                <DriverAvailableJobs driver={driver} onJobClaimed={fetchDriverInfo} />
              </TabsContent>
              <TabsContent value="active-deliveries" className="mt-0">
                <DriverActiveDeliveries driver={driver} onStatusUpdate={fetchDriverInfo} />
              </TabsContent>
              <TabsContent value="live-tracking" className="mt-0">
                <DriverLiveTracking driver={driver} />
              </TabsContent>
              <TabsContent value="ucoin" className="mt-0">
                <UCoinDashboard />
              </TabsContent>
              <TabsContent value="analytics" className="mt-0">
                <DriverAnalytics driver={driver} />
              </TabsContent>
              <TabsContent value="verification" className="mt-0">
                <DriverVerification driver={driver} />
              </TabsContent>
              <TabsContent value="settings" className="mt-0">
                <DriverSettings driver={driver} onUpdate={fetchDriverInfo} />
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default DriverDashboard;