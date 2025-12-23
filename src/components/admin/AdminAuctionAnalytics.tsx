import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { formatCurrency, cn } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay, differenceInHours } from "date-fns";
import { DateRange } from "react-day-picker";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  LineChart,
  Line,
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
  TrendingDown, 
  Gavel,
  Users,
  DollarSign,
  Target,
  Download, 
  Calendar,
  Loader2,
  Trophy,
  Activity
} from "lucide-react";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#82ca9d', '#ffc658', '#ff7300'];

const AdminAuctionAnalytics: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Fetch auctions data
  const { data: auctions, isLoading: auctionsLoading } = useQuery({
    queryKey: ["auction-analytics-auctions", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("auctions")
        .select(`
          *,
          product:products(id, name, price, category, 
            stores(name, vendors(business_name))
          )
        `);

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
  });

  // Fetch registrations data
  const { data: registrations, isLoading: registrationsLoading } = useQuery({
    queryKey: ["auction-analytics-registrations", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("auction_registrations")
        .select("*");

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
  });

  // Fetch bids data
  const { data: bids, isLoading: bidsLoading } = useQuery({
    queryKey: ["auction-analytics-bids", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("auction_bids")
        .select("*");

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
  });

  const isLoading = auctionsLoading || registrationsLoading || bidsLoading;

  // Calculate metrics
  const totalAuctions = auctions?.length || 0;
  const activeAuctions = auctions?.filter(a => a.status === 'active').length || 0;
  const completedAuctions = auctions?.filter(a => a.status === 'sold' || a.status === 'ended').length || 0;
  const pendingAuctions = auctions?.filter(a => a.status === 'pending').length || 0;

  const totalRegistrations = registrations?.length || 0;
  const paidRegistrations = registrations?.filter(r => r.payment_status === 'paid').length || 0;
  const totalRegistrationRevenue = registrations?.reduce((sum, r) => sum + Number(r.registration_fee_paid || 0), 0) || 0;

  const totalBids = bids?.length || 0;
  const totalBidValue = bids?.reduce((sum, b) => sum + Number(b.bid_amount || 0), 0) || 0;
  const avgBidAmount = totalBids > 0 ? totalBidValue / totalBids : 0;

  // Winning bid revenue
  const winningBidRevenue = auctions?.reduce((sum, a) => sum + Number(a.winning_bid || 0), 0) || 0;

  // Conversion rates
  const registrationConversionRate = totalAuctions > 0 ? (totalRegistrations / totalAuctions) * 100 : 0;
  const bidConversionRate = totalRegistrations > 0 ? (totalBids / totalRegistrations) * 100 : 0;
  const saleConversionRate = totalAuctions > 0 ? (completedAuctions / totalAuctions) * 100 : 0;

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

  // Registrations by day
  const registrationsByDay = registrations?.reduce((acc: Record<string, { date: string; registrations: number; revenue: number }>, reg) => {
    const date = format(new Date(reg.created_at), "MMM dd");
    if (!acc[date]) {
      acc[date] = { date, registrations: 0, revenue: 0 };
    }
    acc[date].registrations += 1;
    acc[date].revenue += Number(reg.registration_fee_paid || 0);
    return acc;
  }, {});

  const registrationActivityData = Object.values(registrationsByDay || {}).slice(-14);

  // Status distribution
  const statusDistribution = auctions?.reduce((acc: Record<string, number>, auction) => {
    acc[auction.status] = (acc[auction.status] || 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(statusDistribution || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  // Top performing auctions
  const topAuctions = auctions
    ?.filter(a => a.winning_bid)
    .sort((a, b) => Number(b.winning_bid || 0) - Number(a.winning_bid || 0))
    .slice(0, 5) || [];

  // Unique bidders
  const uniqueBidders = new Set(bids?.map(b => b.user_id) || []).size;

  const handleExport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Auction Analytics Report", pageWidth / 2, 20, { align: "center" });
    
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
    doc.text(`Active Auctions: ${activeAuctions}`, 14, yPos);
    yPos += 6;
    doc.text(`Completed Auctions: ${completedAuctions}`, 14, yPos);
    yPos += 6;
    doc.text(`Total Registrations: ${totalRegistrations}`, 14, yPos);
    yPos += 6;
    doc.text(`Registration Revenue: ${formatCurrency(totalRegistrationRevenue)}`, 14, yPos);
    yPos += 6;
    doc.text(`Total Bids: ${totalBids}`, 14, yPos);
    yPos += 6;
    doc.text(`Winning Bid Revenue: ${formatCurrency(winningBidRevenue)}`, 14, yPos);
    yPos += 12;

    // Top Auctions
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Top Performing Auctions", 14, yPos);
    yPos += 7;

    const auctionTableData = topAuctions.map((auction, index) => [
      `#${index + 1}`,
      auction.product?.name || 'Unknown',
      formatCurrency(auction.winning_bid || 0),
      auction.status
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Rank", "Product", "Winning Bid", "Status"]],
      body: auctionTableData,
      theme: "striped",
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    });

    doc.save(`auction-analytics-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Auction Analytics</h2>
          <p className="text-muted-foreground">
            Track bidding activity, registrations, and conversion metrics.
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
            <CardTitle className="text-sm font-medium">Total Auctions</CardTitle>
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
            <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRegistrations}</div>
            <p className="text-xs text-muted-foreground">
              {paidRegistrations} paid ({registrationConversionRate.toFixed(1)}% rate)
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
              {uniqueBidders} unique bidders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Winning Bid Revenue</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(winningBidRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Avg bid: {formatCurrency(avgBidAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registration Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRegistrationRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              From registration fees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bid Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bidConversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Registrants who placed bids
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sale Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{saleConversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Auctions that resulted in sales
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bidding" className="space-y-6">
        <TabsList>
          <TabsTrigger value="bidding">Bidding Activity</TabsTrigger>
          <TabsTrigger value="registrations">Registration Trends</TabsTrigger>
          <TabsTrigger value="status">Status Distribution</TabsTrigger>
          <TabsTrigger value="top">Top Auctions</TabsTrigger>
        </TabsList>

        <TabsContent value="bidding">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Bid Volume</CardTitle>
                <CardDescription>Number of bids placed per day</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
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

        <TabsContent value="registrations">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Registration Volume</CardTitle>
                <CardDescription>Daily auction registrations</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={registrationActivityData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))' 
                        }} 
                      />
                      <Bar dataKey="registrations" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registration Revenue</CardTitle>
                <CardDescription>Daily registration fee revenue</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={registrationActivityData}>
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
                        dataKey="revenue" 
                        stroke="#82ca9d" 
                        fill="#82ca9d" 
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
                <CardDescription>Breakdown by current status</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
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
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>From auction to sale</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Auctions Created</span>
                    <Badge variant="outline">{totalAuctions}</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '100%' }} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">With Registrations</span>
                    <Badge variant="outline">{totalRegistrations}</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${Math.min(registrationConversionRate, 100)}%` }} 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">With Bids</span>
                    <Badge variant="outline">{totalBids}</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${Math.min(bidConversionRate, 100)}%` }} 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Completed Sales</span>
                    <Badge variant="outline">{completedAuctions}</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${saleConversionRate}%` }} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="top">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Auctions</CardTitle>
              <CardDescription>Auctions with highest winning bids</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : topAuctions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No completed auctions with winning bids yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Winning Bid</TableHead>
                      <TableHead>Base Amount</TableHead>
                      <TableHead>Profit Margin</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topAuctions.map((auction, index) => {
                      const profit = Number(auction.winning_bid || 0) - Number(auction.vendor_base_amount || 0);
                      const profitMargin = auction.vendor_base_amount > 0 
                        ? ((profit / auction.vendor_base_amount) * 100).toFixed(1) 
                        : '0';
                      
                      return (
                        <TableRow key={auction.id}>
                          <TableCell>
                            <Badge variant="outline">#{index + 1}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {auction.product?.name || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            {auction.product?.stores?.vendors?.business_name || 'Unknown'}
                          </TableCell>
                          <TableCell className="font-bold text-primary">
                            {formatCurrency(auction.winning_bid || 0)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(auction.vendor_base_amount || 0)}
                          </TableCell>
                          <TableCell>
                            <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {profit >= 0 ? '+' : ''}{profitMargin}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={auction.status === 'sold' ? 'default' : 'secondary'}
                            >
                              {auction.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAuctionAnalytics;
