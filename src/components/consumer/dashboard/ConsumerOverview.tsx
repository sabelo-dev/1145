import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import {
  Package,
  ShoppingBag,
  Heart,
  Star,
  TrendingUp,
  Clock,
  Truck,
  CreditCard,
  Gift,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Bell,
  Eye,
} from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardStats {
  totalOrders: number;
  activeOrders: number;
  deliveredOrders: number;
  totalSpent: number;
  wishlistCount: number;
  reviewsCount: number;
  loyaltyPoints: number;
  savedAddresses: number;
}

interface RecentOrder {
  id: string;
  status: string;
  total: number;
  date: string;
  itemCount: number;
}

interface ConsumerOverviewProps {
  onNavigate: (section: string) => void;
}

const ConsumerOverview: React.FC<ConsumerOverviewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    activeOrders: 0,
    deliveredOrders: 0,
    totalSpent: 0,
    wishlistCount: 0,
    reviewsCount: 0,
    loyaltyPoints: 0,
    savedAddresses: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Fetch orders
      const { data: ordersData } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          total,
          created_at,
          order_items (id)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Fetch reviews
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("id")
        .eq("user_id", user.id);

      // Fetch addresses
      const { data: addressesData } = await supabase
        .from("user_addresses")
        .select("id")
        .eq("user_id", user.id);

      const orders = ordersData || [];
      const activeStatuses = ["pending", "processing", "shipped", "in_transit"];
      
      setStats({
        totalOrders: orders.length,
        activeOrders: orders.filter((o) => activeStatuses.includes(o.status)).length,
        deliveredOrders: orders.filter((o) => o.status === "delivered").length,
        totalSpent: orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + Number(o.total), 0),
        wishlistCount: 3, // TODO: Connect to actual wishlist
        reviewsCount: reviewsData?.length || 0,
        loyaltyPoints: Math.floor(orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + Number(o.total), 0) / 10),
        savedAddresses: addressesData?.length || 0,
      });

      setRecentOrders(
        orders.slice(0, 5).map((order) => ({
          id: order.id,
          status: order.status,
          total: Number(order.total),
          date: order.created_at,
          itemCount: order.order_items?.length || 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      processing: "bg-blue-500",
      shipped: "bg-purple-500",
      in_transit: "bg-orange-500",
      delivered: "bg-green-500",
      cancelled: "bg-red-500",
    };
    return colors[status] || "bg-muted";
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const quickActions = [
    { icon: Package, label: "Track Orders", section: "orders", color: "text-blue-500" },
    { icon: Heart, label: "Wishlist", section: "wishlist", color: "text-pink-500" },
    { icon: MapPin, label: "Addresses", section: "addresses", color: "text-green-500" },
    { icon: Bell, label: "Notifications", section: "notifications", color: "text-amber-500" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/20">
                <AvatarImage src={user?.avatar_url || ""} alt={user?.name || ""} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">
                  {getGreeting()}, {user?.name?.split(" ")[0] || "there"}!
                </h1>
                <p className="text-muted-foreground">
                  Welcome back to your shopping dashboard
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Button variant="outline" onClick={() => onNavigate("profile")}>
                Edit Profile
              </Button>
              <Link to="/shop">
                <Button>
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Continue Shopping
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Card
            key={action.section}
            className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30"
            onClick={() => onNavigate(action.section)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <span className="font-medium">{action.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Orders</p>
                <p className="text-2xl font-bold">{stats.activeOrders}</p>
              </div>
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <Truck className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold">R{stats.totalSpent.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Loyalty Points</p>
                <p className="text-2xl font-bold">{stats.loyaltyPoints}</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <Gift className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("orders")}>
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No orders yet</p>
                <Link to="/shop">
                  <Button variant="outline" className="mt-4">
                    Start Shopping
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => onNavigate("orders")}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(order.status)}`} />
                      <div>
                        <p className="font-medium">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} •{" "}
                          {formatDistanceToNow(new Date(order.date), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R{order.total.toFixed(2)}</p>
                      <Badge variant="secondary" className="text-xs">
                        {order.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-500" />
                <span className="text-sm">Wishlist Items</span>
              </div>
              <span className="font-semibold">{stats.wishlistCount}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="text-sm">Reviews Written</span>
              </div>
              <span className="font-semibold">{stats.reviewsCount}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-500" />
                <span className="text-sm">Saved Addresses</span>
              </div>
              <span className="font-semibold">{stats.savedAddresses}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Delivered Orders</span>
              </div>
              <span className="font-semibold">{stats.deliveredOrders}</span>
            </div>

            {/* Loyalty Progress */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Loyalty Tier Progress</span>
                <Badge variant="outline">Silver</Badge>
              </div>
              <Progress value={Math.min((stats.loyaltyPoints / 1000) * 100, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {Math.max(0, 1000 - stats.loyaltyPoints)} points to Gold tier
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentOrders.slice(0, 3).map((order, index) => (
              <div key={order.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full ${getStatusColor(order.status)}`} />
                  {index < 2 && <div className="w-0.5 h-full bg-muted mt-1" />}
                </div>
                <div className="flex-1 pb-4">
                  <p className="font-medium">
                    Order #{order.id.slice(0, 8).toUpperCase()} - {order.status.replace(/_/g, " ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(order.date), "PPP 'at' p")}
                  </p>
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsumerOverview;
