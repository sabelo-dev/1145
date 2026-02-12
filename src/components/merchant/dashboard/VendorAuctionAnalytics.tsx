import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { 
  TrendingUp, 
  Gavel,
  Users,
  DollarSign,
  Target,
  Download, 
  Calendar,
  Loader2,
  Trophy,
  Activity,
  Eye
} from "lucide-react";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#82ca9d', '#ffc658', '#ff7300'];

const VendorAuctionAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Fetch vendor's store IDs
  const { data: storeIds } = useQuery({
    queryKey: ["vendor-stores", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!vendor) return [];

      const { data: stores } = await supabase
        .from("stores")
        .select("id")
        .eq("vendor_id", vendor.id);

      return stores?.map(s => s.id) || [];
    },
    enabled: !!user?.id,
  });

  // Fetch vendor's auctions data
  const { data: auctions, isLoading: auctionsLoading } = useQuery({
    queryKey: ["vendor-auction-analytics-auctions", storeIds, dateRange],
    queryFn: async () => {
      if (!storeIds?.length) return [];

      let query = supabase
        .from("auctions")
        .select(`
          *,
          product:products!inner(id, name, price, category, store_id)
        `)
        .in("product.store_id", storeIds);

      if (dateRange?.from) {
        query = query.gte("created_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("created_at", endOfDay(dateRange.to).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeIds?.length,
  });

  // Get auction IDs for filtering
  const auctionIds = auctions?.map(a => a.id) || [];

  // Fetch registrations for vendor's auctions
  const { data: registrations, isLoading: registrationsLoading } = useQuery({
    queryKey: ["vendor-auction-analytics-registrations", auctionIds, dateRange],
    queryFn: async () => {
      if (!auctionIds.length) return [];

      let query = supabase
        .from("auction_registrations")
        .select("*")
        .in("auction_id", auctionIds);

      if (dateRange?.from) {
        query = query.gte("created_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("created_at", endOfDay(dateRange.to).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: auctionIds.length > 0,
  });

  // Fetch bids for vendor's auctions
  const { data: bids, isLoading: bidsLoading } = useQuery({
    queryKey: ["vendor-auction-analytics-bids", auctionIds, dateRange],
    queryFn: async () => {
      if (!auctionIds.length) return [];

      let query = supabase
        .from("auction_bids")
        .select("*")
        .in("auction_id", auctionIds);

      if (dateRange?.from) {
        query = query.gte("created_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("created_at", endOfDay(dateRange.to).toISOString());
      }

      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: auctionIds.length > 0,
  });

  const isLoading = auctionsLoading || registrationsLoading || bidsLoading;

  // Calculate metrics
  const totalAuctions = auctions?.length || 0;
  const activeAuctions = auctions?.filter(a => a.status === 'active').length || 0;
  const completedAuctions = auctions?.filter(a => a.status === 'sold' || a.status === 'ended').length || 0;
  const pendingAuctions = auctions?.filter(a => a.status === 'pending').length || 0;
  const approvedAuctions = auctions?.filter(a => a.status === 'approved').length || 0;

  const totalRegistrations = registrations?.length || 0;
  const paidRegistrations = registrations?.filter(r => r.payment_status === 'paid').length || 0;

  const totalBids = bids?.length || 0;
  const avgBidsPerAuction = totalAuctions > 0 ? totalBids / totalAuctions : 0;

  // Revenue calculations
  const winningBidRevenue = auctions?.reduce((sum, a) => sum + Number(a.winning_bid || 0), 0) || 0;
  const totalBaseAmount = auctions?.reduce((sum, a) => sum + Number(a.vendor_base_amount || 0), 0) || 0;
  const totalProfit = winningBidRevenue - totalBaseAmount;
  const avgProfitMargin = totalBaseAmount > 0 ? (totalProfit / totalBaseAmount) * 100 : 0;

  // Conversion rates
  const saleConversionRate = totalAuctions > 0 
    ? (auctions?.filter(a => a.status === 'sold').length || 0) / totalAuctions * 100 
    : 0;

  // Calculate bidding activity by day
  const biddingActivityByDay = bids?.reduce((acc: Record<string, { date: string; bids: number; value: number }>, bid) => {
    const date = format(new Date(bid.created_at), "MMM dd");
    if (!acc[date]) {
      acc[date] = { date, bids: 0, value: 0 };
    }
    acc[date].bids += 1;
    acc[date].value += Number(bid.bid_amount || 0);
    return acc;
  }, {});

  const biddingActivityData = Object.values(biddingActivityByDay || {}).slice(-14);

  // Status distribution
  const statusDistribution = auctions?.reduce((acc: Record<string, number>, auction) => {
    acc[auction.status] = (acc[auction.status] || 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(statusDistribution || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  // Auction performance data
  const auctionPerformance = auctions?.map(auction => {
    const auctionBids = bids?.filter(b => b.auction_id === auction.id) || [];
    const auctionRegs = registrations?.filter(r => r.auction_id === auction.id) || [];
    const profit = Number(auction.winning_bid || 0) - Number(auction.vendor_base_amount || 0);
    
    return {
      id: auction.id,
      name: auction.product?.name || 'Unknown',
      status: auction.status,
      baseAmount: auction.vendor_base_amount,
      winningBid: auction.winning_bid,
      profit,
      profitMargin: auction.vendor_base_amount > 0 
        ? ((profit / auction.vendor_base_amount) * 100).toFixed(1) 
        : '0',
      totalBids: auctionBids.length,
      registrations: auctionRegs.length,
      uniqueBidders: new Set(auctionBids.map(b => b.user_id)).size,
    };
  }).sort((a, b) => Number(b.winningBid || 0) - Number(a.winningBid || 0)) || [];

  const handleExport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Auction Performance Report", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dateRangeText = dateRange?.from && dateRange?.to 
      ? `${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`
      : "All time";
    doc.text(`Period: ${dateRangeText}`, pageWidth / 2, 28, { align: "center" });
    doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, pageWidth / 2, 34, { align: "center" });
    
    // Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, 45);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    let yPos = 52;
    doc.text(`Total Auctions: ${totalAuctions}`, 14, yPos);
    yPos += 6;
    doc.text(`Active: ${activeAuctions} | Pending: ${pendingAuctions} | Completed: ${completedAuctions}`, 14, yPos);
    yPos += 6;
    doc.text(`Total Registrations: ${totalRegistrations}`, 14, yPos);
    yPos += 6;
    doc.text(`Total Bids: ${totalBids}`, 14, yPos);
    yPos += 6;
    doc.text(`Winning Bid Revenue: ${formatCurrency(winningBidRevenue)}`, 14, yPos);
    yPos += 6;
    doc.text(`Total Profit: ${formatCurrency(totalProfit)}`, 14, yPos);
    yPos += 6;
    doc.text(`Average Profit Margin: ${avgProfitMargin.toFixed(1)}%`, 14, yPos);
    yPos += 12;

    // Auction Performance Table
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Auction Performance", 14, yPos);
    yPos += 7;

    const auctionTableData = auctionPerformance.slice(0, 10).map((auction) => [
      auction.name.substring(0, 20),
      auction.status,
      formatCurrency(auction.baseAmount || 0),
      formatCurrency(auction.winningBid || 0),
      `${auction.profitMargin}%`,
      auction.totalBids.toString(),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Product", "Status", "Base", "Winning Bid", "Margin", "Bids"]],
      body: auctionTableData,
      theme: "striped",
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    });

    doc.save(`auction-performance-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (!storeIds?.length && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Gavel className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Store Found</h3>
        <p className="text-muted-foreground text-center">
          Please set up your store first to view auction analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Auction Analytics</h2>
          <p className="text-muted-foreground">
            Track your auction performance and bidding activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  "Pick a date range"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={handleExport} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Auctions</CardTitle>
            <Gavel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAuctions}</div>
            <p className="text-xs text-muted-foreground">
              {activeAuctions} active, {pendingAuctions} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bids</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBids}</div>
            <p className="text-xs text-muted-foreground">
              Avg {avgBidsPerAuction.toFixed(1)} per auction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(winningBidRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              From winning bids
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalProfit)}
            </div>
            <p className="text-xs text-muted-foreground">
              {avgProfitMargin >= 0 ? '+' : ''}{avgProfitMargin.toFixed(1)}% avg margin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registrations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRegistrations}</div>
            <p className="text-xs text-muted-foreground">
              {paidRegistrations} paid registrations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sale Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{saleConversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Auctions that resulted in sales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedAuctions}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting start date
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList>
          <TabsTrigger value="performance">Auction Performance</TabsTrigger>
          <TabsTrigger value="bidding">Bidding Activity</TabsTrigger>
          <TabsTrigger value="status">Status Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Auction Performance</CardTitle>
              <CardDescription>Detailed metrics for each of your auctions</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : auctionPerformance.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No auctions found. Create your first auction to see analytics.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Base Amount</TableHead>
                      <TableHead>Winning Bid</TableHead>
                      <TableHead>Profit Margin</TableHead>
                      <TableHead>Registrations</TableHead>
                      <TableHead>Bids</TableHead>
                      <TableHead>Unique Bidders</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auctionPerformance.map((auction) => (
                      <TableRow key={auction.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {auction.name}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              auction.status === 'sold' ? 'default' : 
                              auction.status === 'active' ? 'secondary' : 
                              'outline'
                            }
                          >
                            {auction.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(auction.baseAmount || 0)}</TableCell>
                        <TableCell className="font-bold">
                          {auction.winningBid ? formatCurrency(auction.winningBid) : '-'}
                        </TableCell>
                        <TableCell>
                          {auction.winningBid ? (
                            <span className={Number(auction.profit) >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {Number(auction.profit) >= 0 ? '+' : ''}{auction.profitMargin}%
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{auction.registrations}</TableCell>
                        <TableCell>{auction.totalBids}</TableCell>
                        <TableCell>{auction.uniqueBidders}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bidding">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Bid Volume</CardTitle>
                <CardDescription>Number of bids on your auctions per day</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : biddingActivityData.length === 0 ? (
                  <div className="flex justify-center items-center h-[300px] text-muted-foreground">
                    No bidding data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={biddingActivityData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))' 
                        }} 
                      />
                      <Bar dataKey="bids" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bid Value Trend</CardTitle>
                <CardDescription>Total bid value per day</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : biddingActivityData.length === 0 ? (
                  <div className="flex justify-center items-center h-[300px] text-muted-foreground">
                    No bidding data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={biddingActivityData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))' 
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary))" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="status">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Auction Status Distribution</CardTitle>
                <CardDescription>Breakdown of your auctions by status</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : statusData.length === 0 ? (
                  <div className="flex justify-center items-center h-[300px] text-muted-foreground">
                    No auction data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={(entry) => `${entry.name}: ${entry.value}`}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription>Key insights from your auction activity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Best Performing Auction</p>
                      <p className="text-xs text-muted-foreground">
                        {auctionPerformance[0]?.name || 'N/A'}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {auctionPerformance[0]?.winningBid 
                        ? formatCurrency(auctionPerformance[0].winningBid) 
                        : 'N/A'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Average Bids Per Auction</p>
                      <p className="text-xs text-muted-foreground">Across all auctions</p>
                    </div>
                    <Badge variant="outline">{avgBidsPerAuction.toFixed(1)}</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Sale Conversion Rate</p>
                      <p className="text-xs text-muted-foreground">Auctions that sold</p>
                    </div>
                    <Badge variant="outline">{saleConversionRate.toFixed(1)}%</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Total Registrations</p>
                      <p className="text-xs text-muted-foreground">Interested bidders</p>
                    </div>
                    <Badge variant="outline">{totalRegistrations}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VendorAuctionAnalytics;
