import React, { useState, useEffect } from "react";
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
  useSidebar,
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
import VendorOverview from "./dashboard/VendorOverview";
import VendorShopfront from "./dashboard/VendorShopfront";
import VendorProducts from "./dashboard/VendorProducts";
import VendorOrders from "./dashboard/VendorOrders";
import VendorReviews from "./dashboard/VendorReviews";
import VendorInventory from "./dashboard/VendorInventory";
import VendorPromotions from "./dashboard/VendorPromotions";
import VendorPayouts from "./dashboard/VendorPayouts";
import VendorMessages from "./dashboard/VendorMessages";
import VendorSettings from "./dashboard/VendorSettings";
import VendorSupport from "./dashboard/VendorSupport";
import VendorAuctions from "./dashboard/VendorAuctions";
import VendorAuctionAnalytics from "./dashboard/VendorAuctionAnalytics";
import VendorSubscriptionPage from "./dashboard/VendorSubscriptionPage";
import { SubscriptionStatusCard, SubscriptionUpgradeModal } from "./subscription";
import VendorAdCredits from "./dashboard/VendorAdCredits";
import { supabase } from "@/integrations/supabase/client";
import { 
  LayoutDashboard, 
  Store,
  Package, 
  ShoppingCart, 
  Star,
  Warehouse,
  Percent,
  DollarSign,
  MessageSquare,
  Settings, 
  Headphones,
  LogOut,
  User,
  Gavel,
  TrendingUp,
  Coins,
  Crown,
  Megaphone
} from "lucide-react";
import { UCoinDashboard } from "@/components/ucoin/UCoinDashboard";
import { toast } from "sonner";

const VendorDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [vendorData, setVendorData] = useState<any>(null);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    const fetchVendorData = async () => {
      if (!user?.id) return;

      try {
        const { data: vendor, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching vendor data:', error);
          return;
        }

        if (vendor) {
          setVendorData(vendor);
          
          // Check if trial has expired
          if (vendor.subscription_tier === 'trial' && vendor.trial_end_date) {
            const endDate = new Date(vendor.trial_end_date);
            const now = new Date();
            setIsTrialExpired(now > endDate);
          }
        }
      } catch (error) {
        console.error('Error fetching vendor data:', error);
      }
    };

    fetchVendorData();
  }, [user?.id]);

  const sidebarItems = [
    { id: "overview", title: "Dashboard Home", icon: LayoutDashboard },
    { id: "subscription", title: "Subscription", icon: Crown },
    { id: "shopfront", title: "Shopfront", icon: Store },
    { id: "products", title: "Products", icon: Package },
    { id: "auctions", title: "Auctions", icon: Gavel },
    { id: "auction-analytics", title: "Auction Analytics", icon: TrendingUp },
    { id: "orders", title: "Orders", icon: ShoppingCart },
    { id: "reviews", title: "Reviews", icon: Star },
    { id: "inventory", title: "Inventory Manager", icon: Warehouse },
    { id: "promotions", title: "Discounts / Coupons", icon: Percent },
    { id: "ad-credits", title: "Ad Credits", icon: Megaphone },
    { id: "payouts", title: "Earnings / Wallet", icon: DollarSign },
    { id: "ucoin", title: "UCoin Rewards", icon: Coins },
    { id: "messages", title: "Messages", icon: MessageSquare },
    { id: "settings", title: "Settings", icon: Settings },
    { id: "support", title: "Help / Support", icon: Headphones },
  ];

  const handleUpgrade = async (plan: 'standard' | 'premium') => {
    if (!vendorData?.id) return;
    
    const { error } = await supabase
      .from('vendors')
      .update({ subscription_tier: plan })
      .eq('id', vendorData.id);
    
    if (error) {
      toast.error('Failed to update subscription');
      throw error;
    }
    
    // Refresh vendor data
    const { data: updated } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorData.id)
      .single();
    
    if (updated) {
      setVendorData(updated);
    }
    
    toast.success(plan === 'premium' ? 'Welcome to Premium!' : 'Plan updated successfully');
  };

  return (
    <ProtectedRoute requireAuth requireMerchant>
      <SidebarProvider>
        <VendorDashboardContent
          sidebarItems={sidebarItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          handleLogout={handleLogout}
          isTrialExpired={isTrialExpired}
          vendorData={vendorData}
          showUpgradeModal={showUpgradeModal}
          setShowUpgradeModal={setShowUpgradeModal}
          onUpgrade={handleUpgrade}
        />
      </SidebarProvider>
    </ProtectedRoute>
  );
};

interface SidebarItem {
  id: string;
  title: string;
  icon: React.ForwardRefExoticComponent<any>;
}

interface VendorDashboardContentProps {
  sidebarItems: SidebarItem[];
  activeTab: string;
  setActiveTab: (id: string) => void;
  user: any;
  handleLogout: () => void;
  isTrialExpired: boolean;
  vendorData: any;
  showUpgradeModal: boolean;
  setShowUpgradeModal: (show: boolean) => void;
  onUpgrade: (plan: 'standard' | 'premium') => Promise<void>;
}

const VendorDashboardContent: React.FC<VendorDashboardContentProps> = ({
  sidebarItems,
  activeTab,
  setActiveTab,
  user,
  handleLogout,
  isTrialExpired,
  vendorData,
  showUpgradeModal,
  setShowUpgradeModal,
  onUpgrade,
}) => {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleItemClick = (id: string) => {
    setActiveTab(id);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <Sidebar className="border-r">
        <SidebarHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            <span className="font-semibold text-foreground">Merchant Dashboard</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {sidebarItems.map((item) => (
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
                  <AvatarImage src={user?.avatar_url || ''} alt={user?.name || 'Merchant'} />
                  <AvatarFallback>
                    {user?.name?.charAt(0)?.toUpperCase() || 'M'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-medium leading-none">{user?.name || 'Merchant'}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleItemClick('settings')}>
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
          {isTrialExpired && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <h3 className="font-semibold text-destructive mb-2">Trial Expired</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Your trial period has ended. Please upgrade to continue using the merchant dashboard.
              </p>
              <Button onClick={() => setShowUpgradeModal(true)} className="gap-1">
                <Crown className="h-4 w-4" />
                Upgrade Now
              </Button>
            </div>
          )}
          
          {activeTab === 'overview' && vendorData && (
            <SubscriptionStatusCard
              vendorId={vendorData.id}
              onUpgrade={() => setShowUpgradeModal(true)}
              className="mb-6"
            />
          )}
          
          <SubscriptionUpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            currentTier={(vendorData?.subscription_tier as 'starter' | 'bronze' | 'silver' | 'gold') || 'starter'}
            onUpgrade={async (tier, billing) => {
              console.log('Upgrading to:', tier, billing);
              // TODO: Implement actual upgrade logic
              setShowUpgradeModal(false);
            }}
          />
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
            <TabsList className="hidden">
              {sidebarItems.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>
                  {item.title}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value="overview" className="mt-0">
              <VendorOverview onNavigate={setActiveTab} />
            </TabsContent>
            <TabsContent value="subscription" className="mt-0">
              <VendorSubscriptionPage 
                vendorId={vendorData?.id}
                currentTier={(vendorData?.subscription_tier as 'starter' | 'bronze' | 'silver' | 'gold') || 'starter'}
                onUpgrade={() => setShowUpgradeModal(true)}
              />
            </TabsContent>
            <TabsContent value="shopfront" className="mt-0">
              <VendorShopfront />
            </TabsContent>
            <TabsContent value="products" className="mt-0">
              <VendorProducts />
            </TabsContent>
            <TabsContent value="auctions" className="mt-0">
              <VendorAuctions />
            </TabsContent>
            <TabsContent value="auction-analytics" className="mt-0">
              <VendorAuctionAnalytics />
            </TabsContent>
            <TabsContent value="orders" className="mt-0">
              <VendorOrders />
            </TabsContent>
            <TabsContent value="reviews" className="mt-0">
              <VendorReviews />
            </TabsContent>
            <TabsContent value="inventory" className="mt-0">
              <VendorInventory />
            </TabsContent>
            <TabsContent value="promotions" className="mt-0">
              <VendorPromotions />
            </TabsContent>
            <TabsContent value="ad-credits" className="mt-0">
              <VendorAdCredits />
            </TabsContent>
            <TabsContent value="payouts" className="mt-0">
              <VendorPayouts />
            </TabsContent>
            <TabsContent value="ucoin" className="mt-0">
              <UCoinDashboard />
            </TabsContent>
            <TabsContent value="messages" className="mt-0">
              <VendorMessages />
            </TabsContent>
            <TabsContent value="settings" className="mt-0">
              <VendorSettings />
            </TabsContent>
            <TabsContent value="support" className="mt-0">
              <VendorSupport />
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </div>
  );
};

export default VendorDashboard;