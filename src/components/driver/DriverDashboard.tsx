import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Driver } from "@/types/driver";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Package,
  MapPin,
  BarChart3,
  Settings,
  LogOut,
  User,
  Truck,
  Bell,
} from "lucide-react";
import DriverOverview from "./DriverOverview";
import DriverAvailableJobs from "./DriverAvailableJobs";
import DriverActiveDeliveries from "./DriverActiveDeliveries";
import DriverAnalytics from "./DriverAnalytics";
import DriverSettings from "./DriverSettings";

const DriverDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [newJobCount, setNewJobCount] = useState(0);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const previousJobCountRef = useRef<number>(0);

  useEffect(() => {
    fetchDriverData();
    
    // Global realtime subscription for new job notifications
    const channel = supabase
      .channel("driver_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_jobs",
        },
        (payload) => {
          if (payload.new && (payload.new as any).status === "pending") {
            setNewJobCount(prev => prev + 1);
            // Request browser notification permission
            requestNotificationPermission();
            showBrowserNotification(payload.new as any);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  const showBrowserNotification = (job: any) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("New Delivery Job Available!", {
        body: `Delivery to ${job.delivery_address?.city || 'nearby location'}${job.earnings ? ` - R${job.earnings}` : ''}`,
        icon: "/favicon.ico",
        tag: `job-${job.id}`,
      });
    }
  };

  const fetchDriverData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You are not registered as a driver.",
        });
        navigate("/driver/login");
        return;
      }

      setDriver(data as Driver);
    } catch (error) {
      console.error("Error fetching driver data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load driver data",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: Driver["status"]) => {
    if (!driver) return;

    try {
      const { error } = await supabase
        .from("drivers")
        .update({ status: newStatus })
        .eq("id", driver.id);

      if (error) throw error;

      setDriver({ ...driver, status: newStatus });
      toast({
        title: "Status Updated",
        description: `You are now ${newStatus}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update status",
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/driver/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!driver) return null;

  const statusColors: Record<Driver["status"], string> = {
    available: "bg-green-500",
    busy: "bg-yellow-500",
    offline: "bg-gray-500",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Driver Hub</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${statusColors[driver.status]}`}
                  />
                  <span className="capitalize">{driver.status}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Set Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleStatusChange("available")}>
                  <span className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                  Available
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange("busy")}>
                  <span className="h-2 w-2 rounded-full bg-yellow-500 mr-2" />
                  Busy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange("offline")}>
                  <span className="h-2 w-2 rounded-full bg-gray-500 mr-2" />
                  Offline
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar_url || ""} alt={driver.name} />
                    <AvatarFallback>{driver.name?.charAt(0) || "D"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{driver.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveTab("settings")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="available" className="gap-2 relative">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Jobs</span>
              {newJobCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {newJobCount > 9 ? "9+" : newJobCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Active</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <DriverOverview driver={driver} />
          </TabsContent>
          <TabsContent value="available">
            <DriverAvailableJobs driver={driver} onJobAccepted={() => { fetchDriverData(); setNewJobCount(0); }} />
          </TabsContent>
          <TabsContent value="active">
            <DriverActiveDeliveries driver={driver} onStatusUpdate={fetchDriverData} />
          </TabsContent>
          <TabsContent value="analytics">
            <DriverAnalytics driver={driver} />
          </TabsContent>
          <TabsContent value="settings">
            <DriverSettings driver={driver} onUpdate={fetchDriverData} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default DriverDashboard;
