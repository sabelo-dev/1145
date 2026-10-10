import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import MerchantOverview from "./dashboard/MerchantOverview";
import MerchantShopfront from "./dashboard/MerchantShopfront";
import MerchantProducts from "./dashboard/MerchantProducts";
import MerchantOrders from "./dashboard/MerchantOrders";
import MerchantReviews from "./dashboard/MerchantReviews";
import MerchantInventory from "./dashboard/MerchantInventory";
import MerchantPromotions from "./dashboard/MerchantPromotions";
import MerchantPayouts from "./dashboard/MerchantPayouts";
import MerchantMessages from "./dashboard/MerchantMessages";
import MerchantSettings from "./dashboard/MerchantSettings";
import MerchantSupport from "./dashboard/MerchantSupport";
import MerchantAuctions from "./dashboard/MerchantAuctions";
import MerchantAuctionAnalytics from "./dashboard/MerchantAuctionAnalytics";
import MerchantSubscriptionPage from "./dashboard/MerchantSubscriptionPage";
import { SubscriptionStatusCard, SubscriptionUpgradeModal } from "./subscription";
import MerchantAdCredits from "./dashboard/MerchantAdCredits";
import MerchantSubscriptionPayments from "./dashboard/MerchantSubscriptionPayments";
import MerchantApiAccess from "./dashboard/MerchantApiAccess";
import MerchantCustomDomain from "./dashboard/MerchantCustomDomain";
import MerchantLeases from "./dashboard/MerchantLeases";
import MerchantLodging from "./dashboard/MerchantLodging";
import MerchantRideAnalytics from "./dashboard/MerchantRideAnalytics";
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
  Truck,
  LogOut,
  User,
  Gavel,
  TrendingUp,
  Coins,
  Crown,
  Megaphone,
  Key,
  Globe,
  CreditCard,
  Building2,
} from "lucide-react";
import { UCoinDashboard } from "@/components/ucoin/UCoinDashboard";
import { toast } from "sonner";
import { useSubscriptionActions } from "@/hooks/useSubscriptionActions";
import type { SubscriptionTier } from "@/services/subscription";
import { normalizeTier } from "@/utils/subscriptionTier";
import { useUrlTab } from "@/hooks/useUrlTab";

const MerchantDashboard = () => {
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useUrlTab("overview");
  const [merchantData, setMerchantData] = useState<any>(null);
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
    const fetchMerchantData = async () => {
      if (!user?.id) return;

      try {
        const { data: merchant, error } = await supabase
          .from('merchants')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching merchant data:', error);
          return;
        }

        if (merchant) {
          setMerchantData(merchant);
          
          // Check if trial has expired
          if (merchant.subscription_tier === 'trial' && merchant.trial_end_date) {
            const endDate = new Date(merchant.trial_end_date);
            const now = new Date();
            setIsTrialExpired(now > endDate);
          }
        }
      } catch (error) {
        console.error('Error fetching merchant data:', error);
      }
    };

    fetchMerchantData();
  }, [user?.id]);

  const sidebarItems = [
    { id: "overview", title: "Dashboard Home", icon: LayoutDashboard },
    { id: "subscription", title: "Subscription", icon: Crown },
    { id: "billing", title: "Billing & Payments", icon: CreditCard },
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
    { id: "api-access", title: "API Access", icon: Key },
    { id: "custom-domain", title: "Custom Domain", icon: Globe },
    { id: "messages", title: "Messages", icon: MessageSquare },
    { id: "leasing", title: "Leasing", icon: Package },
    { id: "lodging", title: "Lodging / Stays", icon: Building2 },
    { id: "delivery-analytics", title: "Delivery Analytics", icon: Truck },
    { id: "settings", title: "Settings", icon: Settings },
    { id: "support", title: "Help / Support", icon: Headphones },
  ];

  const refreshMerchantData = async () => {
    if (!user?.id) return;
    const { data: updated } = await supabase
      .from('merchants')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (updated) setMerchantData(updated);
  };

  const { changePlan, cancelPlan } = useSubscriptionActions({
    currentTier: normalizeTier(merchantData?.subscription_tier) as SubscriptionTier,
    onChanged: refreshMerchantData,
  });

  const handleUpgrade = async (tier: SubscriptionTier, billing: 'monthly' | 'yearly') => {
    const result = await changePlan(tier, billing);
    if (!result?.redirected) setShowUpgradeModal(false);
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Cancel your subscription? You keep access until the current period ends.')) return;
    await cancelPlan().catch(() => undefined);
  };

  // Handle return from PayFast checkout
  useEffect(() => {
    const status = searchParams.get('subscription');
    if (!status) return;
    if (status === 'success') {
      toast.success('Payment received — your new plan activates within a minute.');
      setActiveTab('subscription');
      setTimeout(() => { refreshMerchantData(); }, 4000);
    } else if (status === 'cancelled') {
      toast.info('Subscription checkout cancelled.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);


  return (
    <ProtectedRoute requireAuth requireMerchant>
      <SidebarProvider>
        <MerchantDashboardContent
          sidebarItems={sidebarItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          handleLogout={handleLogout}
          isTrialExpired={isTrialExpired}
          merchantData={merchantData}
          showUpgradeModal={showUpgradeModal}
          setShowUpgradeModal={setShowUpgradeModal}
          onUpgrade={handleUpgrade}
          onCancelSubscription={handleCancelSubscription}
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

interface MerchantDashboardContentProps {
  sidebarItems: SidebarItem[];
  activeTab: string;
  setActiveTab: (id: string) => void;
  user: any;
  handleLogout: () => void;
  isTrialExpired: boolean;
  merchantData: any;
  showUpgradeModal: boolean;
  setShowUpgradeModal: (show: boolean) => void;
  onUpgrade: (tier: SubscriptionTier, billing: 'monthly' | 'yearly') => Promise<void>;
  onCancelSubscription: () => Promise<void>;
}

const MerchantDashboardContent: React.FC<MerchantDashboardContentProps> = ({
  sidebarItems,
  activeTab,
  setActiveTab,
  user,
  handleLogout,
  isTrialExpired,
  merchantData,
  showUpgradeModal,
  setShowUpgradeModal,
  onUpgrade,
  onCancelSubscription,
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
      
      <SidebarInset className="flex-1 min-w-0 overflow-x-hidden">
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
        
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6 bg-background">
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
          
          {activeTab === 'overview' && merchantData && (
            <SubscriptionStatusCard
              merchantId={merchantData.id}
              onUpgrade={() => setShowUpgradeModal(true)}
              onCancel={onCancelSubscription}
              className="mb-6"
            />
          )}
          
          <SubscriptionUpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            currentTier={normalizeTier(merchantData?.subscription_tier)}
            onUpgrade={onUpgrade}
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
              <MerchantOverview onNavigate={setActiveTab} />
            </TabsContent>
            <TabsContent value="subscription" className="mt-0">
              <MerchantSubscriptionPage 
                merchantId={merchantData?.id}
                currentTier={normalizeTier(merchantData?.subscription_tier)}
                onUpgrade={(tier, billing) => {
                  if (tier && billing) {
                    return onUpgrade(tier, billing);
                  } else {
                    setShowUpgradeModal(true);
                  }
                }}
              />
            </TabsContent>
            <TabsContent value="billing" className="mt-0">
              <MerchantSubscriptionPayments />
            </TabsContent>
            <TabsContent value="shopfront" className="mt-0">
              <MerchantShopfront />
            </TabsContent>
            <TabsContent value="products" className="mt-0">
              <MerchantProducts />
            </TabsContent>
            <TabsContent value="auctions" className="mt-0">
              <MerchantAuctions />
            </TabsContent>
            <TabsContent value="auction-analytics" className="mt-0">
              <MerchantAuctionAnalytics />
            </TabsContent>
            <TabsContent value="orders" className="mt-0">
              <MerchantOrders />
            </TabsContent>
            <TabsContent value="reviews" className="mt-0">
              <MerchantReviews />
            </TabsContent>
            <TabsContent value="inventory" className="mt-0">
              <MerchantInventory />
            </TabsContent>
            <TabsContent value="promotions" className="mt-0">
              <MerchantPromotions />
            </TabsContent>
            <TabsContent value="ad-credits" className="mt-0">
              <MerchantAdCredits />
            </TabsContent>
            <TabsContent value="payouts" className="mt-0">
              <MerchantPayouts />
            </TabsContent>
            <TabsContent value="ucoin" className="mt-0">
              <UCoinDashboard />
            </TabsContent>
            <TabsContent value="api-access" className="mt-0">
              <MerchantApiAccess />
            </TabsContent>
            <TabsContent value="custom-domain" className="mt-0">
              <MerchantCustomDomain />
            </TabsContent>
            <TabsContent value="messages" className="mt-0">
              <MerchantMessages />
            </TabsContent>
            <TabsContent value="settings" className="mt-0">
              <MerchantSettings />
            </TabsContent>
            <TabsContent value="support" className="mt-0">
              <MerchantSupport />
            </TabsContent>
            <TabsContent value="leasing" className="mt-0">
              <MerchantLeases />
            </TabsContent>
            <TabsContent value="lodging" className="mt-0">
              <MerchantLodging />
            </TabsContent>
            <TabsContent value="delivery-analytics" className="mt-0">
              <MerchantRideAnalytics />
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </div>
  );
};

export default MerchantDashboard;