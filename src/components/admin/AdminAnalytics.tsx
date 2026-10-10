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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Download, 
  Calendar,
  Users,
  ShoppingCart,
  Loader2
} from "lucide-react";

const AdminAnalytics: React.FC = () => {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Fetch orders data
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin-orders", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*, order_items(quantity, price)");

      if (dateRange?.from) {
        query = query.gte("created_at", startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("created_at", endOfDay(dateRange.to).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch merchants data
  const { data: merchants, isLoading: merchantsLoading } = useQuery({
    queryKey: ["admin-merchants-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select(`
          *,
          stores(
            id,
            products(id),
            orders:order_items(order_id, price, quantity)
          )
        `)
        .eq("status", "approved");
      if (error) throw error;
      return data;
    },
  });

  // Fetch products data
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["admin-products-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          stores(name, merchants(business_name)),
          order_items(quantity, price)
        `)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles count
  const { data: profilesCount } = useQuery({
    queryKey: ["admin-profiles-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const isLoading = ordersLoading || merchantsLoading || productsLoading;

  // Calculate metrics
  const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;
  const totalOrders = orders?.length || 0;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const handleExport = () => {
    if (!orders || !merchants || !products) {
      toast({
        title: "Export failed",
        description: "Data is still loading. Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Analytics Report", pageWidth / 2, 20, { align: "center" });
      
      // Date Range
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const dateRangeText = dateRange?.from && dateRange?.to 
        ? `${format(dateRange.from, "MMM dd, yyyy")} - ${format(dateRange.to, "MMM dd, yyyy")}`
        : "All time";
      doc.text(`Period: ${dateRangeText}`, pageWidth / 2, 28, { align: "center" });
      doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, pageWidth / 2, 34, { align: "center" });
      
      // Summary Section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Summary", 14, 45);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      let yPos = 52;
      doc.text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 14, yPos);
      yPos += 6;
      doc.text(`Total Orders: ${totalOrders}`, 14, yPos);
      yPos += 6;
      doc.text(`Average Order Value: ${formatCurrency(averageOrderValue)}`, 14, yPos);
      yPos += 6;
      doc.text(`Total Registered Users: ${profilesCount || 0}`, 14, yPos);
      yPos += 12;

      // Top Merchants Table
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Top Performing Merchants", 14, yPos);
      yPos += 7;

      const merchantTableData = merchantPerformance.slice(0, 10).map((merchant, index) => [
        `#${index + 1}`,
        merchant.name,
        formatCurrency(merchant.revenue),
        merchant.orders.toString(),
        merchant.products.toString()
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Rank", "Merchant", "Revenue", "Orders", "Products"]],
        body: merchantTableData,
        theme: "striped",
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 }
      });

      // Top Products Table
      yPos = (doc as any).lastAutoTable.finalY + 12;
      
      // Add new page if needed
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Top Performing Products", 14, yPos);
      yPos += 7;

      const productTableData = productPerformance.slice(0, 10).map((product, index) => [
        `#${index + 1}`,
        product.name,
        product.merchant,
        product.category,
        product.sales.toString(),
        formatCurrency(product.revenue)
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Rank", "Product", "Merchant", "Category", "Sales", "Revenue"]],
        body: productTableData,
        theme: "striped",
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
      });

      // Recent Orders Table
      yPos = (doc as any).lastAutoTable.finalY + 12;
      
      // Add new page if needed
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Recent Orders", 14, yPos);
      yPos += 7;

      const ordersTableData = orders.slice(0, 15).map(order => [
        order.id.slice(0, 8),
        format(new Date(order.created_at), "MMM dd, yyyy"),
        order.status,
        formatCurrency(order.total)
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Order ID", "Date", "Status", "Total"]],
        body: ordersTableData,
        theme: "striped",
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 }
      });

      // Save PDF
      doc.save(`analytics-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);

      toast({
        title: "Export successful",
        description: "Analytics report has been generated as PDF.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Export failed",
        description: "Failed to generate PDF report.",
        variant: "destructive",
      });
    }
  };

  // Calculate merchant performance
  const merchantPerformance = merchants?.map(merchant => {
    const storeOrders = merchant.stores?.flatMap(store => store.orders || []) || [];
    const revenue = storeOrders.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    const orderIds = new Set(storeOrders.map(item => item.order_id));
    const productsCount = merchant.stores?.reduce((sum, store) => sum + (store.products?.length || 0), 0) || 0;

    return {
      id: merchant.id,
      name: merchant.business_name,
      revenue,
      orders: orderIds.size,
      products: productsCount,
    };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 10) || [];

  // Calculate product performance
  const productPerformance = products?.map(product => {
    const sales = product.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    const revenue = product.order_items?.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) || 0;
    const storeName = product.stores?.name || "Unknown";
    const merchantName = product.stores?.merchants?.business_name || "Unknown";

    return {
      id: product.id,
      name: product.name,
      merchant: merchantName,
      store: storeName,
      category: product.category,
      sales,
      revenue,
    };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 10) || [];

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold">Analytics & Reports</h2>
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
            Export Data
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {dateRange?.from && dateRange?.to 
                ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`
                : "All time"}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              Total orders in period
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</div>
            <p className="text-xs text-muted-foreground">
              Average order value
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profilesCount}</div>
            <p className="text-xs text-muted-foreground">
              Total registered users
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sales">Sales Trends</TabsTrigger>
          <TabsTrigger value="merchants">Merchant Performance</TabsTrigger>
          <TabsTrigger value="products">Product Analytics</TabsTrigger>
          <TabsTrigger value="customer">Customer Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>Sales Summary</CardTitle>
              <CardDescription>
                {dateRange?.from && dateRange?.to 
                  ? `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
                  : "All time"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex flex-col p-4 border rounded-lg">
                      <span className="text-sm text-muted-foreground">Total Revenue</span>
                      <span className="text-2xl font-bold">{formatCurrency(totalRevenue)}</span>
                    </div>
                    <div className="flex flex-col p-4 border rounded-lg">
                      <span className="text-sm text-muted-foreground">Total Orders</span>
                      <span className="text-2xl font-bold">{totalOrders}</span>
                    </div>
                    <div className="flex flex-col p-4 border rounded-lg">
                      <span className="text-sm text-muted-foreground">Average Order Value</span>
                      <span className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</span>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">Recent Orders</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders?.slice(0, 10).map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-sm">{order.id.slice(0, 8)}</TableCell>
                            <TableCell>{format(new Date(order.created_at), "MMM d, yyyy")}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{order.status}</Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(order.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="merchants">
          <Card>
              <CardHeader>
                <CardTitle>Merchant Performance Ranking</CardTitle>
                <CardDescription>Top performing merchants by revenue</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableCaption>Merchant performance metrics</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead>Products</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {merchantPerformance.map((merchant, index) => (
                        <TableRow key={merchant.id}>
                          <TableCell>
                            <Badge variant="outline">#{index + 1}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{merchant.name}</TableCell>
                          <TableCell>{formatCurrency(merchant.revenue)}</TableCell>
                          <TableCell>{merchant.orders}</TableCell>
                          <TableCell>{merchant.products}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
              <CardHeader>
                <CardTitle>Product Performance</CardTitle>
                <CardDescription>Best selling products</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableCaption>Top performing products</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Sales</TableHead>
                        <TableHead>Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productPerformance.map((product, index) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <Badge variant="outline">#{index + 1}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.merchant}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{product.category}</Badge>
                          </TableCell>
                          <TableCell>{product.sales}</TableCell>
                          <TableCell>{formatCurrency(product.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer">
          <Card>
            <CardHeader>
              <CardTitle>Customer Insights</CardTitle>
              <CardDescription>User statistics and metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col p-4 border rounded-lg">
                      <span className="text-sm text-muted-foreground">Total Registered Users</span>
                      <span className="text-2xl font-bold">{profilesCount}</span>
                    </div>
                    <div className="flex flex-col p-4 border rounded-lg">
                      <span className="text-sm text-muted-foreground">Total Orders</span>
                      <span className="text-2xl font-bold">{totalOrders}</span>
                    </div>
                    <div className="flex flex-col p-4 border rounded-lg">
                      <span className="text-sm text-muted-foreground">Average Order Value</span>
                      <span className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</span>
                    </div>
                    <div className="flex flex-col p-4 border rounded-lg">
                      <span className="text-sm text-muted-foreground">Total Revenue</span>
                      <span className="text-2xl font-bold">{formatCurrency(totalRevenue)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAnalytics;
