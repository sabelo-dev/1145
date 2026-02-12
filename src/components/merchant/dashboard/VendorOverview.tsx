
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  Package, 
  ShoppingCart, 
  DollarSign, 
  TrendingUp,
  Eye,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle,
  Star,
  Target,
  Zap,
  Calendar,
  Bell,
  MessageSquare,
  Percent,
  ExternalLink,
  Copy
} from "lucide-react";

interface VendorOverviewProps {
  onNavigate: (tab: string) => void;
}

const VendorOverview: React.FC<VendorOverviewProps> = ({ onNavigate }) => {
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
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchVendorData = async () => {
      if (!user?.id) return;

      try {
        // Get vendor and store data
        const { data: vendor } = await supabase
          .from('vendors')
          .select('*, stores(*)')
          .eq('user_id', user.id)
          .single();

        if (!vendor || !vendor.stores || vendor.stores.length === 0) {
          setLoading(false);
          return;
        }

        const store = vendor.stores[0]; // Get the first store
        setStoreInfo(store);
        const storeIds = vendor.stores.map((store: any) => store.id);

        // Fetch products data
        const { data: products } = await supabase
          .from('products')
          .select('*')
          .in('store_id', storeIds);

        // Fetch orders data
        const { data: orders } = await supabase
          .from('order_items')
          .select(`
            *,
            orders(*)
          `)
          .in('store_id', storeIds)
          .order('created_at', { ascending: false });

        // Fetch payouts data
        const { data: payouts } = await supabase
          .from('payouts')
          .select('*')
          .eq('vendor_id', vendor.id);

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

        // Calculate comprehensive profile completion
        let completionScore = 0;
        const checks = [
          vendor.business_name,           // Business name (10%)
          vendor.description,             // Vendor description (10%)
          store.name,                     // Store name (10%)
          store.description,              // Store description (10%)
          store.logo_url,                 // Store logo (15%)
          store.banner_url,               // Store banner (15%)
          store.shipping_policy,          // Shipping policy (10%)
          store.return_policy,            // Return policy (10%)
          totalProducts > 0,              // Has products (10%)
          vendor.status === 'approved'    // Approved status (10%)
        ];
        
        completionScore = checks.filter(Boolean).length * 10;

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
        console.error('Error fetching vendor data:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load dashboard data."
        });
      } finally {
        setLoading(false);
      }
    };

    fetchVendorData();
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
                  const storefrontUrl = `${window.location.origin}/store/${storeInfo.slug}`;
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
                  const storefrontUrl = `${window.location.origin}/store/${storeInfo.slug}`;
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
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
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
                    Complete your profile to start listing products
                  </p>
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

      {/* Enhanced Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{stats.todayRevenue.toFixed(2)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span>7d: R{stats.weeklyRevenue.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newOrders}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <span>{stats.pendingOrders} pending • {stats.processingOrders} processing</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              R{stats.avgOrderValue} avg order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Store Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayViews}</div>
            <p className="text-xs text-muted-foreground flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              {stats.weeklyViews} this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts and Notifications */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Low Stock</span>
                <span className="font-medium text-orange-600">{stats.lowStockItems} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Out of Stock</span>
                <span className="font-medium text-red-600">{stats.outOfStockItems} items</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Promotions</CardTitle>
            <Percent className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activePromotions}</div>
            <p className="text-xs text-muted-foreground">
              Black Friday ends in 5 days
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingPayouts}</div>
            <p className="text-xs text-muted-foreground">
              Next: R{(stats.revenue * 0.85).toFixed(2)} on Jan 30
            </p>
          </CardContent>
        </Card>
      </div>

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

      {/* AI Insights & Recommendations */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            AI-Powered Insights
          </CardTitle>
          <CardDescription>Actionable recommendations to grow your business</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
              <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium">Demand Spike Detected</h4>
                <p className="text-sm text-muted-foreground">
                  Your trending products need more inventory. Consider restocking to meet demand.
                </p>
              </div>
              <Button 
                size="sm"
                onClick={() => {
                  onNavigate('inventory');
                  toast({
                    title: "Navigating to Inventory",
                    description: "Review and update your stock levels."
                  });
                }}
              >
                Act Now
              </Button>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
              <Percent className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium">Dynamic Pricing Opportunity</h4>
                <p className="text-sm text-muted-foreground">
                  Optimize your pricing strategy with promotions to increase revenue.
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  onNavigate('products');
                  toast({
                    title: "Navigating to Products",
                    description: "Review and adjust your product pricing."
                  });
                }}
              >
                Review
              </Button>
            </div>

            <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
              <Calendar className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium">Seasonal Preparation</h4>
                <p className="text-sm text-muted-foreground">
                  Plan ahead with seasonal promotions and product bundles to boost sales.
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  onNavigate('promotions');
                  toast({
                    title: "Navigating to Promotions",
                    description: "Create seasonal promotions and bundles."
                  });
                }}
              >
                Plan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorOverview;
