import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
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
import AdminOverview from "@/components/admin/AdminOverview";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminVendors from "@/components/admin/AdminVendors";
import AdminProducts from "@/components/admin/AdminProducts";
import AdminOrders from "@/components/admin/AdminOrders";
import AdminCategories from "@/components/admin/AdminCategories";
import AdminReviews from "@/components/admin/AdminReviews";
import AdminCMS from "@/components/admin/AdminCMS";
import AdminNotifications from "@/components/admin/AdminNotifications";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import AdminAuditLogs from "@/components/admin/AdminAuditLogs";
import AdminSettings from "@/components/admin/AdminSettings";
import { AdminShipping } from "@/components/admin/AdminShipping";
import AdminDrivers from "@/components/admin/AdminDrivers";
import AdminDriverPayouts from "@/components/admin/AdminDriverPayouts";
import {
  LayoutDashboard,
  Users,
  Store,
  Package, 
  ShoppingCart, 
  MessageSquare,
  DollarSign,
  FileText,
  Megaphone,
  BarChart3,
  FileText as AuditIcon,
  Settings,
  Shield,
  LogOut,
  User,
  Truck,
  Car,
  Wallet
} from "lucide-react";

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const sidebarItems = [
    { id: "overview", title: "Overview", icon: LayoutDashboard },
    { id: "users", title: "User Management", icon: Users },
    { id: "vendors", title: "Vendor Management", icon: Store },
    { id: "drivers", title: "Driver Management", icon: Car },
    { id: "driver-payouts", title: "Driver Payouts", icon: Wallet },
    { id: "orders", title: "Orders (All)", icon: ShoppingCart },
    { id: "products", title: "Products (All)", icon: Package },
    { id: "categories", title: "Categories", icon: FileText },
    { id: "analytics", title: "Reports & Analytics", icon: BarChart3 },
    { id: "settings", title: "System Settings", icon: Settings },
    { id: "reviews", title: "Reviews & Complaints", icon: MessageSquare },
    { id: "cms", title: "CMS / Pages", icon: FileText },
    { id: "notifications", title: "Notifications", icon: Megaphone },
    { id: "audit", title: "Logs / Audit Trail", icon: AuditIcon },
    { id: "shipping", title: "Shipping Management", icon: Truck },
  ];

  return (
    <ProtectedRoute requireAuth requireAdmin>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <Sidebar className="border-r">
            <SidebarHeader className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                <span className="font-semibold text-foreground">Admin Dashboard</span>
              </div>
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
                  {sidebarItems.find(item => item.id === activeTab)?.title}
                </h1>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.avatar_url || ''} alt={user?.name || 'Admin'} />
                      <AvatarFallback>
                        {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex flex-col space-y-1 p-2">
                    <p className="text-sm font-medium leading-none">{user?.name || 'Admin'}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveTab('settings')}>
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
                  <AdminOverview />
                </TabsContent>
                <TabsContent value="users" className="mt-0">
                  <AdminUsers />
                </TabsContent>
                <TabsContent value="vendors" className="mt-0">
                  <AdminVendors />
                </TabsContent>
                <TabsContent value="drivers" className="mt-0">
                  <AdminDrivers />
                </TabsContent>
                <TabsContent value="driver-payouts" className="mt-0">
                  <AdminDriverPayouts />
                </TabsContent>
                <TabsContent value="products" className="mt-0">
                  <AdminProducts />
                </TabsContent>
                <TabsContent value="orders" className="mt-0">
                  <AdminOrders />
                </TabsContent>
                <TabsContent value="categories" className="mt-0">
                  <AdminCategories />
                </TabsContent>
                <TabsContent value="analytics" className="mt-0">
                  <AdminAnalytics />
                </TabsContent>
                <TabsContent value="settings" className="mt-0">
                  <AdminSettings />
                </TabsContent>
                <TabsContent value="reviews" className="mt-0">
                  <AdminReviews />
                </TabsContent>
                <TabsContent value="cms" className="mt-0">
                  <AdminCMS />
                </TabsContent>
                <TabsContent value="notifications" className="mt-0">
                  <AdminNotifications />
                </TabsContent>
                <TabsContent value="audit" className="mt-0">
                  <AdminAuditLogs />
                </TabsContent>
                <TabsContent value="shipping" className="mt-0">
                  <AdminShipping />
                </TabsContent>
              </Tabs>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
};

export default AdminDashboard;