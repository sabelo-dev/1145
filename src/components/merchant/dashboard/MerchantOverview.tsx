
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAppUrl } from "@/lib/appUrl";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import MerchantInsights from "./MerchantInsights";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
// The charts (recharts) load on their own, so the rest of the home page shows first.
const MerchantStoreAnalytics = lazyWithRetry(() => import("./MerchantStoreAnalytics"));
import { 
  Package, 
  ShoppingCart, 
  DollarSign, 
  TrendingUp,
  AlertTriangle,
  Clock,
  Star,
  Bell,
  MessageSquare,
  Percent,
  ExternalLink,
  Copy
} from "lucide-react";

interface MerchantOverviewProps {
  onNavigate: (tab: string) => void;
}

const MerchantOverview: React.FC<MerchantOverviewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    pendingApproval: 0,
    totalOrders: 0,
    newOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    shippedOrders: 0,
    revenue: 0,
    todayRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    storeViews: 0,
    todayViews: 0,
    weeklyViews: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    rating: 0,
    reviewCount: 0,
    profileCompletion: 0,
    conversionRate: 0,
    avgOrderValue: 0,
    returnRate: 0,
    activePromotions: 0,
    pendingPayouts: 0
  });
  // What "Complete your profile" is made of: each step, whether it is done, and where to do it.
  const [profileSteps, setProfileSteps] = useState<Array<{ label: string; done: boolean; tab: string }>>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchMerchantData = async () => {
      if (!user?.id) return;

      try {
        // Get merchant and store data
        const { data: merchant } = await supabase
          .from('merchants')
          .select('*, stores(*)')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!merchant || !merchant.stores || merchant.stores.length === 0) {
          setLoading(false);
          return;
        }

        const store = merchant.stores[0]; // Get the first store
        setStoreInfo(store);
        const storeIds = merchant.stores.map((store: any) => store.id);

        // Fetch products data
        const { data: products } = await supabase
          .from('products')
          .select('*')
          .in('store_id', storeIds);

        // Fetch paid orders only (unpaid checkouts aren't orders yet)
        const { data: orders } = await supabase
          .from('order_items')
          .select(`
            *,
            orders!inner(*)
          `)
          .in('store_id', storeIds)
          .eq('orders.payment_status', 'paid')
          .order('created_at', { ascending: false });

        // Fetch payouts data
        const { data: payouts } = await supabase
          .from('payouts')
          .select('*')
          .eq('merchant_id', merchant.id);

        // Calculate stats
        const totalProducts = products?.length || 0;
        const activeProducts = products?.filter(p => p.status === 'approved' || p.status === 'active').length || 0;
        const pendingApproval = products?.filter(p => p.status === 'pending').length || 0;
        const lowStock = products?.filter(p => p.quantity > 0 && p.quantity <= 5).length || 0;
        const outOfStock = products?.filter(p => p.quantity === 0).length || 0;

        const totalOrders = orders?.length || 0;
        const newOrders = orders?.filter(o => o.status === 'pending').length || 0;
        const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
        const processingOrders = orders?.filter(o => o.status === 'processing').length || 0;
        const shippedOrders = orders?.filter(o => o.status === 'shipped').length || 0;

        const totalRevenue = orders?.reduce((sum, order) => sum + (parseFloat(order.price?.toString() || '0') * order.quantity), 0) || 0;
        const today = new Date().toDateString();
        const todayRevenue = orders?.filter(o => new Date(o.created_at).toDateString() === today)
          .reduce((sum, order) => sum + (parseFloat(order.price?.toString() || '0') * order.quantity), 0) || 0;

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weeklyRevenue = orders?.filter(o => new Date(o.created_at) >= weekAgo)
          .reduce((sum, order) => sum + (parseFloat(order.price?.toString() || '0') * order.quantity), 0) || 0;

        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const monthlyRevenue = orders?.filter(o => new Date(o.created_at) >= monthAgo)
          .reduce((sum, order) => sum + (parseFloat(order.price?.toString() || '0') * order.quantity), 0) || 0;

        const pendingPayoutsCount = payouts?.filter(p => p.status === 'pending').length || 0;

        // Payouts need a verified bank account, so it is part of the profile.
        const { count: verifiedBankAccounts } = await supabase
          .from('merchant_payment_methods')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', merchant.id)
          .not('verified_at', 'is', null);

        // Profile completion: only steps the merchant can do themselves, each
        // with the tab where it is done. Onboarding saves the return policy and
        // shipping methods on the merchant, the Shopfront tab on the store.
        const filled = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
        const steps = [
          { label: 'Add your business name', done: filled(merchant.business_name), tab: 'settings' },
          { label: 'Describe your business', done: filled(merchant.description), tab: 'settings' },
          { label: 'Name your store', done: filled(store.name), tab: 'shopfront' },
          { label: 'Describe your store', done: filled(store.description), tab: 'shopfront' },
          { label: 'Upload a store logo', done: filled(store.logo_url), tab: 'shopfront' },
          { label: 'Upload a store banner', done: filled(store.banner_url), tab: 'shopfront' },
          {
            label: 'Add a shipping policy',
            done: filled(store.shipping_policy) || (merchant.shipping_methods?.length ?? 0) > 0,
            tab: 'shopfront',
          },
          {
            label: 'Add a return policy',
            done: filled(store.return_policy) || filled(merchant.return_policy),
            tab: 'shopfront',
          },
          { label: 'List your first product', done: totalProducts > 0, tab: 'products' },
          { label: 'Add a verified bank account for payouts', done: (verifiedBankAccounts ?? 0) > 0, tab: 'settings' },
        ];
        setProfileSteps(steps);
        
        const completionScore = Math.round((steps.filter(step => step.done).length / steps.length) * 100);

        // Get recent orders with customer info
        const recentOrdersData = orders?.slice(0, 3).map(order => ({
          id: order.id,
          customer: 'Customer', // Customer data not available in current schema
          product: 'Product', // Product name would need join
          amount: parseFloat(order.price?.toString() || '0') * order.quantity,
          status: order.status,
          date: new Date(order.created_at).toLocaleDateString()
        })) || [];

        // Get low stock products
        const lowStockData = products?.filter(p => p.quantity > 0 && p.quantity <= 5)
          .slice(0, 4).map(product => ({
            name: product.name,
            stock: product.quantity,
            threshold: 10 // Default threshold
          })) || [];

        setStats({
          totalProducts,
          activeProducts,
          pendingApproval,
          totalOrders,
          newOrders,
          pendingOrders,
          processingOrders,
          shippedOrders,
          revenue: totalRevenue,
          todayRevenue,
          weeklyRevenue,
          monthlyRevenue,
          storeViews: 0, // Not tracked in current schema
          todayViews: 0,
          weeklyViews: 0,
          lowStockItems: lowStock,
          outOfStockItems: outOfStock,
          rating: 0, // Not implemented yet
          reviewCount: 0, // Not implemented yet
          profileCompletion: completionScore,
          conversionRate: 0, // Would need view tracking
          avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
          returnRate: 0, // Not tracked yet
          activePromotions: 0, // Not implemented yet
          pendingPayouts: pendingPayoutsCount
        });

        setRecentOrders(recentOrdersData);
        setLowStockProducts(lowStockData);

      } catch (error) {
        console.error('Error fetching merchant data:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load dashboard data."
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMerchantData();
  }, [user?.id, toast]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "destructive";
      case "processing": return "default";
      case "shipped": return "secondary";
      case "delivered": return "default";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">Loading dashboard data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your store today.
          </p>
          {/* Storefront Link */}
          {storeInfo?.slug && (
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const storefrontUrl = getAppUrl(`/store/${storeInfo.slug}`);
                  window.open(storefrontUrl, '_blank');
                }}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View Storefront
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const storefrontUrl = getAppUrl(`/store/${storeInfo.slug}`);
                  navigator.clipboard.writeText(storefrontUrl);
                  toast({
                    title: "Copied!",
                    description: "Storefront link copied to clipboard."
                  });
                }}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>
            </div>
          )}
        </div>
        <div className="text-right space-y-1">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-gold text-gold" />
            <span className="font-medium">{stats.rating}</span>
            <span className="text-sm text-muted-foreground">({stats.reviewCount} reviews)</span>
          </div>
        </div>
      </div>

      {/* Profile Completion Alert */}
      {stats.profileCompletion < 100 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <h3 className="font-medium">Complete your profile</h3>
                  <p className="text-sm text-muted-foreground">
                    {profileSteps.filter(step => step.done).length} of {profileSteps.length} steps done. Still to do:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {profileSteps.filter(step => !step.done).map(step => (
                      <Button key={step.label} variant="outline" size="sm" onClick={() => onNavigate(step.tab)}>
                        {step.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{stats.profileCompletion}%</div>
                <Progress value={stats.profileCompletion} className="w-24 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales, customers, products and stock for all stores, worked out in the database */}
      <React.Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" aria-label="Loading store analytics" />}>
        <MerchantStoreAnalytics onNavigate={onNavigate} />
      </React.Suspense>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest orders from your customers</CardDescription>
            </div>
            {stats.newOrders > 0 && (
              <Badge variant="destructive">{stats.newOrders} new</Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{order.customer}</p>
                    <p className="text-sm text-muted-foreground">{order.product}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm font-medium">R{order.amount}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusColor(order.status)}>
                        {order.status === "new" && <Clock className="h-3 w-3 mr-1" />}
                        {order.status === "processing" && <Package className="h-3 w-3 mr-1" />}
                        {order.status === "shipped" && <TrendingUp className="h-3 w-3 mr-1" />}
                        {order.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{order.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Low Stock Alert
              </CardTitle>
              <CardDescription>Products running low on inventory</CardDescription>
            </div>
            <Badge variant="outline">{stats.lowStockItems} items</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockProducts.length > 0 ? (
                lowStockProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Threshold: {product.threshold} units
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive" className="text-xs">
                        {product.stock} left
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All products are well stocked!
                </p>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-4"
              onClick={() => onNavigate('inventory')}
            >
              Update Stock Levels
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Automate routine tasks and access key features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-6">
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => onNavigate('products')}
            >
              <Package className="h-4 w-4 mr-2" />
              Add Product
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => onNavigate('promotions')}
            >
              <Percent className="h-4 w-4 mr-2" />
              Create Promotion
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => onNavigate('orders')}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Process Orders
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => onNavigate('payouts')}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Request Payout
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => onNavigate('support')}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Contact Support
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => onNavigate('settings')}
            >
              <Bell className="h-4 w-4 mr-2" />
              Set Alerts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Store insights from the figures above, and 1145 AI when it is enabled */}
      <MerchantInsights stats={stats} onNavigate={onNavigate} />
    </div>
  );
};

export default MerchantOverview;
