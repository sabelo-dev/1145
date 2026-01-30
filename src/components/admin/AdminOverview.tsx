import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  ShoppingBag, 
  Package, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  Store,
  UserCheck
} from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<any>;
  trend?: string;
  trendValue?: number;
  trendColor?: "green" | "red" | "yellow" | "neutral";
}

const KPICard: React.FC<KPICardProps> = ({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend, 
  trendValue,
  trendColor = "neutral" 
}) => {
  const getTrendIcon = () => {
    if (trendValue === undefined || trendValue === 0) return null;
    return trendValue > 0 ? (
      <TrendingUp className="h-3 w-3 mr-1" />
    ) : (
      <TrendingDown className="h-3 w-3 mr-1" />
    );
  };

  const getBadgeVariant = () => {
    if (trendColor === "green") return "default";
    if (trendColor === "red") return "destructive";
    return "outline";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <div className="flex items-center pt-1">
            <Badge 
              variant={getBadgeVariant()}
              className="text-xs flex items-center"
            >
              {getTrendIcon()}
              {trend}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Helper to calculate percentage change
const calcPercentChange = (current: number, previous: number): { value: number; formatted: string } => {
  if (previous === 0) {
    if (current === 0) return { value: 0, formatted: "No change" };
    return { value: 100, formatted: "+100%" };
  }
  const change = ((current - previous) / previous) * 100;
  const formatted = change === 0 ? "No change" : 
    (change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`);
  return { value: change, formatted };
};

// Helper to get trend color based on value and whether higher is better
const getTrendColor = (value: number, higherIsBetter: boolean = true): "green" | "red" | "neutral" => {
  if (value === 0) return "neutral";
  if (higherIsBetter) return value > 0 ? "green" : "red";
  return value < 0 ? "green" : "red";
};

const AdminOverview: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    // Current values
    totalVendors: 0,
    activeVendors: 0,
    pendingVendors: 0,
    totalSales: 0,
    todaySales: 0,
    yesterdaySales: 0,
    thisMonthSales: 0,
    lastMonthSales: 0,
    pendingOrders: 0,
    fulfilledOrders: 0,
    totalOrders: 0,
    lowStockAlerts: 0,
    outOfStockAlerts: 0,
    totalProducts: 0,
    openTickets: 0,
    commissionToday: 0,
    commissionYesterday: 0,
    commissionThisMonth: 0,
    commissionLastMonth: 0,
    // Signups
    newVendorsThisWeek: 0,
    newVendorsLastWeek: 0,
    newCustomersThisWeek: 0,
    newCustomersLastWeek: 0,
    // Vendors
    newVendorsThisMonth: 0,
    newVendorsLastMonth: 0,
    // Reviews
    totalReviews: 0,
    flaggedProducts: 0,
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        // Date calculations
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(thisMonthStart.getTime() - 1);
        const thisWeekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastWeekStart = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

        // Fetch all data in parallel
        const [
          { data: vendors },
          { data: orders },
          { data: products },
          { data: profiles },
          { data: reviews },
        ] = await Promise.all([
          supabase.from('vendors').select('*'),
          supabase.from('orders').select('*'),
          supabase.from('products').select('*'),
          supabase.from('profiles').select('id, role, created_at'),
          supabase.from('reviews').select('id'),
        ]);

        // Vendor calculations
        const totalVendors = vendors?.length || 0;
        const activeVendors = vendors?.filter(v => v.status === 'approved').length || 0;
        const pendingVendors = vendors?.filter(v => v.status === 'pending').length || 0;
        
        const newVendorsThisMonth = vendors?.filter(v => 
          new Date(v.created_at) >= thisMonthStart
        ).length || 0;
        const newVendorsLastMonth = vendors?.filter(v => 
          new Date(v.created_at) >= lastMonthStart && new Date(v.created_at) <= lastMonthEnd
        ).length || 0;

        const newVendorsThisWeek = vendors?.filter(v => 
          new Date(v.created_at) >= thisWeekStart
        ).length || 0;
        const newVendorsLastWeek = vendors?.filter(v => 
          new Date(v.created_at) >= lastWeekStart && new Date(v.created_at) < thisWeekStart
        ).length || 0;

        // Order and sales calculations
        const totalOrders = orders?.length || 0;
        const totalSales = orders?.reduce((sum, order) => 
          sum + parseFloat(order.total?.toString() || '0'), 0) || 0;

        const todayOrders = orders?.filter(o => new Date(o.created_at) >= today) || [];
        const todaySales = todayOrders.reduce((sum, order) => 
          sum + parseFloat(order.total?.toString() || '0'), 0);

        const yesterdayOrders = orders?.filter(o => {
          const d = new Date(o.created_at);
          return d >= yesterday && d < today;
        }) || [];
        const yesterdaySales = yesterdayOrders.reduce((sum, order) => 
          sum + parseFloat(order.total?.toString() || '0'), 0);

        const thisMonthOrders = orders?.filter(o => new Date(o.created_at) >= thisMonthStart) || [];
        const thisMonthSales = thisMonthOrders.reduce((sum, order) => 
          sum + parseFloat(order.total?.toString() || '0'), 0);

        const lastMonthOrders = orders?.filter(o => {
          const d = new Date(o.created_at);
          return d >= lastMonthStart && d <= lastMonthEnd;
        }) || [];
        const lastMonthSales = lastMonthOrders.reduce((sum, order) => 
          sum + parseFloat(order.total?.toString() || '0'), 0);

        const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
        const fulfilledOrders = orders?.filter(o => 
          o.status === 'completed' || o.status === 'shipped' || o.status === 'delivered'
        ).length || 0;

        // Product calculations
        const totalProducts = products?.length || 0;
        const lowStockItems = products?.filter(p => p.quantity > 0 && p.quantity <= 5).length || 0;
        const outOfStockItems = products?.filter(p => p.quantity === 0).length || 0;
        const flaggedProducts = products?.filter(p => p.status === 'pending' || p.status === 'flagged').length || 0;

        // Commission calculation (15% platform fee)
        const COMMISSION_RATE = 0.15;
        const commissionToday = todaySales * COMMISSION_RATE;
        const commissionYesterday = yesterdaySales * COMMISSION_RATE;
        const commissionThisMonth = thisMonthSales * COMMISSION_RATE;
        const commissionLastMonth = lastMonthSales * COMMISSION_RATE;

        // Customer signups
        const consumers = profiles?.filter(p => p.role === 'consumer') || [];
        const newCustomersThisWeek = consumers.filter(c => 
          new Date(c.created_at) >= thisWeekStart
        ).length;
        const newCustomersLastWeek = consumers.filter(c => {
          const d = new Date(c.created_at);
          return d >= lastWeekStart && d < thisWeekStart;
        }).length;

        // Recent activities
        const activities = [
          ...vendors?.filter(v => v.status === 'pending').slice(0, 2).map(v => ({
            type: 'vendor_application',
            title: 'New vendor application',
            description: v.business_name,
            status: 'Pending',
            variant: 'outline' as const
          })) || [],
          ...products?.filter(p => p.status === 'pending').slice(0, 2).map(p => ({
            type: 'product_review',
            title: 'Product pending review',
            description: p.name,
            status: 'Review',
            variant: 'destructive' as const
          })) || [],
          ...orders?.filter(o => parseFloat(o.total?.toString() || '0') > 1000)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 2).map(o => ({
            type: 'large_order',
            title: 'Large order placed',
            description: formatCurrency(parseFloat(o.total?.toString() || '0')),
            status: o.status,
            variant: 'default' as const
          })) || []
        ];

        setKpiData({
          totalVendors,
          activeVendors,
          pendingVendors,
          totalSales,
          todaySales,
          yesterdaySales,
          thisMonthSales,
          lastMonthSales,
          pendingOrders,
          fulfilledOrders,
          totalOrders,
          lowStockAlerts: lowStockItems,
          outOfStockAlerts: outOfStockItems,
          totalProducts,
          openTickets: 0,
          commissionToday,
          commissionYesterday,
          commissionThisMonth,
          commissionLastMonth,
          newVendorsThisWeek,
          newVendorsLastWeek,
          newCustomersThisWeek,
          newCustomersLastWeek,
          newVendorsThisMonth,
          newVendorsLastMonth,
          totalReviews: reviews?.length || 0,
          flaggedProducts,
        });

        setRecentActivities(activities);

      } catch (error) {
        console.error('Error fetching admin data:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load dashboard data."
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [toast]);

  // Calculate all percentage changes
  const vendorGrowth = calcPercentChange(kpiData.newVendorsThisMonth, kpiData.newVendorsLastMonth);
  const salesGrowth = calcPercentChange(kpiData.thisMonthSales, kpiData.lastMonthSales);
  const todayVsYesterday = calcPercentChange(kpiData.todaySales, kpiData.yesterdaySales);
  const commissionVsYesterday = calcPercentChange(kpiData.commissionToday, kpiData.commissionYesterday);
  const signupsGrowth = calcPercentChange(
    kpiData.newVendorsThisWeek + kpiData.newCustomersThisWeek,
    kpiData.newVendorsLastWeek + kpiData.newCustomersLastWeek
  );

  // Calculate fulfillment rate
  const fulfillmentRate = kpiData.totalOrders > 0 
    ? ((kpiData.fulfilledOrders / kpiData.totalOrders) * 100).toFixed(1) 
    : '0';

  // Calculate inventory health
  const inventoryAlerts = kpiData.lowStockAlerts + kpiData.outOfStockAlerts;
  const inventoryHealthPercent = kpiData.totalProducts > 0 
    ? (((kpiData.totalProducts - inventoryAlerts) / kpiData.totalProducts) * 100).toFixed(1)
    : '100';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold">Platform Overview</h2>
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <KPICard
          title="Total Vendors"
          value={kpiData.totalVendors}
          description={`${kpiData.activeVendors} active, ${kpiData.pendingVendors} pending`}
          icon={Store}
          trend={`${kpiData.newVendorsThisMonth > 0 ? '+' : ''}${kpiData.newVendorsThisMonth} this month`}
          trendValue={kpiData.newVendorsThisMonth}
          trendColor={kpiData.newVendorsThisMonth > 0 ? "green" : "neutral"}
        />
        
        <KPICard
          title="Total Sales"
          value={formatCurrency(kpiData.totalSales)}
          description={`${formatCurrency(kpiData.thisMonthSales)} this month`}
          icon={DollarSign}
          trend={`${salesGrowth.formatted} vs last month`}
          trendValue={salesGrowth.value}
          trendColor={getTrendColor(salesGrowth.value)}
        />
        
        <KPICard
          title="Today's Sales"
          value={formatCurrency(kpiData.todaySales)}
          description={`Yesterday: ${formatCurrency(kpiData.yesterdaySales)}`}
          icon={TrendingUp}
          trend={`${todayVsYesterday.formatted} vs yesterday`}
          trendValue={todayVsYesterday.value}
          trendColor={getTrendColor(todayVsYesterday.value)}
        />
        
        <KPICard
          title="Orders"
          value={kpiData.totalOrders}
          description={`${kpiData.pendingOrders} pending, ${kpiData.fulfilledOrders} fulfilled`}
          icon={ShoppingBag}
          trend={`${fulfillmentRate}% fulfillment rate`}
          trendValue={parseFloat(fulfillmentRate)}
          trendColor={parseFloat(fulfillmentRate) >= 80 ? "green" : parseFloat(fulfillmentRate) >= 50 ? "yellow" : "red"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <KPICard
          title="Inventory Alerts"
          value={inventoryAlerts}
          description={`${kpiData.lowStockAlerts} low stock, ${kpiData.outOfStockAlerts} out of stock`}
          icon={AlertTriangle}
          trend={`${inventoryHealthPercent}% healthy inventory`}
          trendValue={inventoryAlerts > 0 ? -1 : 0}
          trendColor={inventoryAlerts === 0 ? "green" : inventoryAlerts <= 5 ? "yellow" : "red"}
        />
        
        <KPICard
          title="Products"
          value={kpiData.totalProducts}
          description={`${kpiData.flaggedProducts} need review`}
          icon={Package}
          trend={kpiData.flaggedProducts > 0 ? `${kpiData.flaggedProducts} pending approval` : "All approved"}
          trendValue={kpiData.flaggedProducts > 0 ? -1 : 1}
          trendColor={kpiData.flaggedProducts === 0 ? "green" : "yellow"}
        />
        
        <KPICard
          title="Commission (Today)"
          value={formatCurrency(kpiData.commissionToday)}
          description={`This month: ${formatCurrency(kpiData.commissionThisMonth)}`}
          icon={DollarSign}
          trend={`${commissionVsYesterday.formatted} vs yesterday`}
          trendValue={commissionVsYesterday.value}
          trendColor={getTrendColor(commissionVsYesterday.value)}
        />
        
        <KPICard
          title="New Signups (Week)"
          value={kpiData.newVendorsThisWeek + kpiData.newCustomersThisWeek}
          description={`${kpiData.newVendorsThisWeek} vendors, ${kpiData.newCustomersThisWeek} customers`}
          icon={UserCheck}
          trend={`${signupsGrowth.formatted} vs last week`}
          trendValue={signupsGrowth.value}
          trendColor={getTrendColor(signupsGrowth.value)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Latest platform activities requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No recent activities requiring attention</p>
              ) : (
                recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                    </div>
                    <Badge variant={activity.variant}>{activity.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Platform performance at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-sm">Active vendor rate</span>
                <Badge variant="outline">
                  {kpiData.totalVendors > 0 
                    ? `${((kpiData.activeVendors / kpiData.totalVendors) * 100).toFixed(1)}%` 
                    : '0%'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-sm">Avg. order value</span>
                <Badge variant="outline">
                  {kpiData.totalOrders > 0 
                    ? formatCurrency(kpiData.totalSales / kpiData.totalOrders) 
                    : formatCurrency(0)}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-sm">Total reviews</span>
                <Badge variant="outline">{kpiData.totalReviews}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-sm">Pending vendors to review</span>
                <Badge variant={kpiData.pendingVendors > 0 ? "destructive" : "outline"}>
                  {kpiData.pendingVendors}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
