import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import {
  Package,
  ShoppingBag,
  Heart,
  Star,
  Clock,
  Truck,
  CreditCard,
  Gift,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Bell,
  Gavel,
  Trophy,
  AlertCircle,
  TrendingUp,
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
  auctionsWon: number;
  activeBids: number;
  watchedAuctions: number;
}

interface RecentOrder {
  id: string;
  status: string;
  total: number;
  date: string;
  itemCount: number;
}

interface AuctionActivity {
  id: string;
  type: "bid" | "won" | "outbid" | "watching";
  auctionId: string;
  productName: string;
  amount: number;
  date: string;
  status?: string;
}

interface ActivityItem {
  id: string;
  type: "order" | "bid" | "review" | "auction_won" | "wishlist";
  title: string;
  description: string;
  date: string;
  icon: React.ElementType;
  color: string;
  link?: string;
}

interface ConsumerOverviewProps {
  onNavigate: (section: string) => void;
}

const ConsumerOverview: React.FC<ConsumerOverviewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { wishlistItems } = useWishlist();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    activeOrders: 0,
    deliveredOrders: 0,
    totalSpent: 0,
    wishlistCount: 0,
    reviewsCount: 0,
    loyaltyPoints: 0,
    savedAddresses: 0,
    auctionsWon: 0,
    activeBids: 0,
    watchedAuctions: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [auctionActivities, setAuctionActivities] = useState<AuctionActivity[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, wishlistItems]);

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
        .select("id, created_at, rating, products(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      // Fetch addresses
      const { data: addressesData } = await supabase
        .from("user_addresses")
        .select("id")
        .eq("user_id", user.id);

      // Fetch auction bids
      const { data: bidsData } = await supabase
        .from("auction_bids")
        .select(`
          id,
          bid_amount,
          created_at,
          auction_id,
          auctions (
            id,
            status,
            current_bid,
            winner_id,
            products (name)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      // Fetch auction watchlist
      const { data: watchlistData } = await supabase
        .from("auction_watchlist")
        .select("id, auction_id")
        .eq("user_id", user.id);

      // Fetch won auctions
      const { data: wonAuctionsData } = await supabase
        .from("auctions")
        .select(`
          id,
          winning_bid,
          updated_at,
          products (name)
        `)
        .eq("winner_id", user.id)
        .eq("status", "sold")
        .order("updated_at", { ascending: false });

      const orders = ordersData || [];
      const activeStatuses = ["pending", "processing", "shipped", "in_transit"];
      const bids = bidsData || [];
      const wonAuctions = wonAuctionsData || [];

      // Calculate unique active bids (latest bid per auction where auction is still active)
      const activeBidAuctions = new Set(
        bids
          .filter((b: any) => b.auctions?.status === "active")
          .map((b: any) => b.auction_id)
      );

      setStats({
        totalOrders: orders.length,
        activeOrders: orders.filter((o) => activeStatuses.includes(o.status)).length,
        deliveredOrders: orders.filter((o) => o.status === "delivered").length,
        totalSpent: orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + Number(o.total), 0),
        wishlistCount: wishlistItems.length,
        reviewsCount: reviewsData?.length || 0,
        loyaltyPoints: Math.floor(orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + Number(o.total), 0) / 10),
        savedAddresses: addressesData?.length || 0,
        auctionsWon: wonAuctions.length,
        activeBids: activeBidAuctions.size,
        watchedAuctions: watchlistData?.length || 0,
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

      // Build auction activities
      const auctionActs: AuctionActivity[] = [];
      
      // Add won auctions
      wonAuctions.forEach((auction: any) => {
        auctionActs.push({
          id: `won-${auction.id}`,
          type: "won",
          auctionId: auction.id,
          productName: auction.products?.name || "Unknown Product",
          amount: auction.winning_bid || 0,
          date: auction.updated_at,
          status: "sold",
        });
      });

      // Add recent bids
      bids.slice(0, 10).forEach((bid: any) => {
        const isWinning = bid.auctions?.current_bid === bid.bid_amount;
        auctionActs.push({
          id: `bid-${bid.id}`,
          type: isWinning ? "bid" : "outbid",
          auctionId: bid.auction_id,
          productName: bid.auctions?.products?.name || "Unknown Product",
          amount: bid.bid_amount,
          date: bid.created_at,
          status: bid.auctions?.status,
        });
      });

      // Sort by date
      auctionActs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAuctionActivities(auctionActs.slice(0, 10));

      // Build combined activity feed
      const allActivities: ActivityItem[] = [];

      // Add orders to activity
      orders.slice(0, 5).forEach((order) => {
        allActivities.push({
          id: `order-${order.id}`,
          type: "order",
          title: `Order #${order.id.slice(0, 8).toUpperCase()}`,
          description: `${order.order_items?.length || 0} items • R${Number(order.total).toFixed(2)} • ${order.status.replace(/_/g, " ")}`,
          date: order.created_at,
          icon: Package,
          color: "text-blue-500",
        });
      });

      // Add bids to activity
      bids.slice(0, 5).forEach((bid: any) => {
        allActivities.push({
          id: `bid-${bid.id}`,
          type: "bid",
          title: `Bid placed on ${bid.auctions?.products?.name || "Auction"}`,
          description: `R${bid.bid_amount.toFixed(2)} bid`,
          date: bid.created_at,
          icon: Gavel,
          color: "text-amber-500",
        });
      });

      // Add won auctions to activity
      wonAuctions.forEach((auction: any) => {
        allActivities.push({
          id: `won-${auction.id}`,
          type: "auction_won",
          title: `Won auction: ${auction.products?.name || "Item"}`,
          description: `Winning bid: R${auction.winning_bid?.toFixed(2) || "0.00"}`,
          date: auction.updated_at,
          icon: Trophy,
          color: "text-green-500",
        });
      });

      // Add reviews to activity
      (reviewsData || []).slice(0, 3).forEach((review: any) => {
        allActivities.push({
          id: `review-${review.id}`,
          type: "review",
          title: `Reviewed ${review.products?.name || "Product"}`,
          description: `${review.rating} star review`,
          date: review.created_at,
          icon: Star,
          color: "text-yellow-500",
        });
      });

      // Sort by date
      allActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(allActivities.slice(0, 10));

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
    { icon: Package, label: "Track Orders", section: "orders", color: "text-blue-500", count: stats.activeOrders },
    { icon: Gavel, label: "Auctions", section: "auction-watchlist", color: "text-amber-500", count: stats.activeBids },
    { icon: Heart, label: "Wishlist", section: "wishlist", color: "text-pink-500", count: stats.wishlistCount },
    { icon: Bell, label: "Notifications", section: "notifications", color: "text-purple-500" },
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
          <div className="flex items-center justify-between flex-wrap gap-4">
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
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onNavigate("profile")}>
                Edit Profile
              </Button>
              <Link to="/shop">
                <Button>
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Shop Now
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
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${action.color}`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <span className="font-medium text-sm">{action.label}</span>
              </div>
              {action.count !== undefined && action.count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {action.count}
                </Badge>
              )}
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
                <p className="text-sm text-muted-foreground">Auctions Won</p>
                <p className="text-2xl font-bold">{stats.auctionsWon}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <Trophy className="h-5 w-5 text-green-600" />
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
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <CreditCard className="h-5 w-5 text-amber-600" />
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
        {/* Activity Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full grid grid-cols-3 mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="auctions">Auctions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all">
                <ScrollArea className="h-[320px]">
                  {activities.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No recent activity</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activities.map((activity, index) => (
                        <div key={activity.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`p-2 rounded-full bg-muted ${activity.color}`}>
                              <activity.icon className="h-4 w-4" />
                            </div>
                            {index < activities.length - 1 && (
                              <div className="w-0.5 h-full bg-muted mt-2" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="font-medium text-sm">{activity.title}</p>
                            <p className="text-sm text-muted-foreground">{activity.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(activity.date), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="orders">
                <ScrollArea className="h-[320px]">
                  {recentOrders.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No orders yet</p>
                      <Link to="/shop">
                        <Button variant="outline" className="mt-4">Start Shopping</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentOrders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => onNavigate("orders")}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-2 w-2 rounded-full ${getStatusColor(order.status)}`} />
                            <div>
                              <p className="font-medium text-sm">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                              <p className="text-xs text-muted-foreground">
                                {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} •{" "}
                                {formatDistanceToNow(new Date(order.date), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm">R{order.total.toFixed(2)}</p>
                            <Badge variant="secondary" className="text-xs">
                              {order.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="auctions">
                <ScrollArea className="h-[320px]">
                  {auctionActivities.length === 0 ? (
                    <div className="text-center py-8">
                      <Gavel className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No auction activity</p>
                      <Link to="/auctions">
                        <Button variant="outline" className="mt-4">Browse Auctions</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {auctionActivities.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => onNavigate("auction-watchlist")}
                        >
                          <div className="flex items-center gap-3">
                            {activity.type === "won" ? (
                              <Trophy className="h-5 w-5 text-green-500" />
                            ) : activity.type === "outbid" ? (
                              <AlertCircle className="h-5 w-5 text-orange-500" />
                            ) : (
                              <Gavel className="h-5 w-5 text-amber-500" />
                            )}
                            <div>
                              <p className="font-medium text-sm line-clamp-1">{activity.productName}</p>
                              <p className="text-xs text-muted-foreground">
                                {activity.type === "won" ? "Won" : activity.type === "outbid" ? "Outbid" : "Bid placed"} •{" "}
                                {formatDistanceToNow(new Date(activity.date), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm">R{activity.amount.toFixed(2)}</p>
                            <Badge 
                              variant={activity.type === "won" ? "default" : activity.type === "outbid" ? "destructive" : "secondary"} 
                              className="text-xs"
                            >
                              {activity.type === "won" ? "Won" : activity.type === "outbid" ? "Outbid" : "Active"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Account Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => onNavigate("orders")}
            >
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-amber-500" />
                <span className="text-sm">Active Orders</span>
              </div>
              <span className="font-semibold">{stats.activeOrders}</span>
            </div>

            <div 
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => onNavigate("auction-watchlist")}
            >
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-amber-500" />
                <span className="text-sm">Active Bids</span>
              </div>
              <span className="font-semibold">{stats.activeBids}</span>
            </div>

            <div 
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => onNavigate("wishlist")}
            >
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-500" />
                <span className="text-sm">Wishlist Items</span>
              </div>
              <span className="font-semibold">{stats.wishlistCount}</span>
            </div>

            <div 
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => onNavigate("reviews")}
            >
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">Reviews Written</span>
              </div>
              <span className="font-semibold">{stats.reviewsCount}</span>
            </div>

            <div 
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => onNavigate("addresses")}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-500" />
                <span className="text-sm">Saved Addresses</span>
              </div>
              <span className="font-semibold">{stats.savedAddresses}</span>
            </div>

            {/* Loyalty Progress */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Loyalty Tier</span>
                <Badge variant="outline">
                  {stats.loyaltyPoints >= 1000 ? "Gold" : stats.loyaltyPoints >= 500 ? "Silver" : "Bronze"}
                </Badge>
              </div>
              <Progress 
                value={Math.min(
                  stats.loyaltyPoints >= 1000 
                    ? 100 
                    : stats.loyaltyPoints >= 500 
                      ? ((stats.loyaltyPoints - 500) / 500) * 100 
                      : (stats.loyaltyPoints / 500) * 100, 
                  100
                )} 
                className="h-2" 
              />
              <p className="text-xs text-muted-foreground mt-2">
                {stats.loyaltyPoints >= 1000 
                  ? "You've reached Gold tier!" 
                  : stats.loyaltyPoints >= 500 
                    ? `${1000 - stats.loyaltyPoints} points to Gold tier`
                    : `${500 - stats.loyaltyPoints} points to Silver tier`
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConsumerOverview;
