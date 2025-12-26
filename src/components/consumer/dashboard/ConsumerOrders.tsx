import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import {
  Package,
  Eye,
  RotateCcw,
  X,
  MapPin,
  RefreshCw,
  Truck,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Download,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import OrderTrackingDialog from "./OrderTrackingDialog";
import OrderDetailsModal from "./OrderDetailsModal";

interface OrderProduct {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

interface Order {
  id: string;
  date: string;
  status: string;
  total: number;
  items: number;
  vendor: string;
  trackingNumber: string | null;
  products: OrderProduct[];
  shipping_address?: any;
  estimated_delivery?: string | null;
  courier_name?: string | null;
  courier_phone?: string | null;
  courier_company?: string | null;
}

const ORDERS_PER_PAGE = 5;

const STATUS_OPTIONS = [
  { value: "all", label: "All Orders" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const ConsumerOrders: React.FC = () => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchOrders();

      const channel = supabase
        .channel("consumer_orders")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      // Optimized: Fetch orders with items in a single query
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          total,
          created_at,
          shipping_address,
          tracking_number,
          estimated_delivery,
          courier_name,
          courier_phone,
          courier_company,
          order_items (
            id,
            quantity,
            price,
            products (
              name,
              product_images (image_url, position)
            ),
            stores (name)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      const ordersWithItems = (ordersData || []).map((order: any) => {
        const items = order.order_items || [];
        
        const products: OrderProduct[] = items.map((item: any) => {
          const images = item.products?.product_images || [];
          const sortedImages = [...images].sort(
            (a: any, b: any) => (a.position || 0) - (b.position || 0)
          );
          const firstImage = sortedImages[0]?.image_url;

          return {
            id: item.id,
            name: item.products?.name || "Unknown Product",
            quantity: item.quantity,
            price: Number(item.price),
            image_url: firstImage,
          };
        });

        const vendor = items[0]?.stores?.name || "Unknown Vendor";

        return {
          id: order.id,
          date: order.created_at,
          status: order.status,
          total: Number(order.total),
          items: products.length,
          vendor,
          trackingNumber: order.tracking_number,
          products,
          shipping_address: order.shipping_address,
          estimated_delivery: order.estimated_delivery,
          courier_name: order.courier_name,
          courier_phone: order.courier_phone,
          courier_company: order.courier_company,
        };
      });

      setOrders(ordersWithItems);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch orders",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter and search orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesSearch =
        searchQuery === "" ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.products.some((p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ORDERS_PER_PAGE;
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  // Order stats
  const orderStats = useMemo(() => {
    const activeOrders = orders.filter((o) =>
      ["pending", "processing", "shipped", "in_transit"].includes(o.status)
    ).length;
    const deliveredOrders = orders.filter((o) => o.status === "delivered").length;
    const totalSpent = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total, 0);
    return { activeOrders, deliveredOrders, totalSpent };
  }, [orders]);

  const getStatusBadge = (status: string) => {
    const config: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
    > = {
      pending: { variant: "secondary" },
      processing: { variant: "default", className: "bg-blue-500" },
      shipped: { variant: "outline", className: "border-amber-500 text-amber-600" },
      in_transit: { variant: "default", className: "bg-amber-500" },
      delivered: { variant: "default", className: "bg-green-500" },
      cancelled: { variant: "destructive" },
      returned: { variant: "secondary" },
    };

    const { variant, className } = config[status] || { variant: "secondary" };

    return (
      <Badge variant={variant} className={className}>
        {status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  const canCancel = (status: string) => ["pending", "processing"].includes(status);
  const canReturn = (status: string) => status === "delivered";
  const canTrack = (status: string) =>
    ["processing", "shipped", "in_transit", "delivered"].includes(status);

  const handleTrackOrder = (order: Order) => {
    setSelectedOrder(order);
    setTrackingDialogOpen(true);
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setDetailsModalOpen(true);
  };

  // Export to CSV
  const exportToCSV = () => {
    const dataToExport = filteredOrders.length > 0 ? filteredOrders : orders;
    
    if (dataToExport.length === 0) {
      toast({
        variant: "destructive",
        title: "No data to export",
        description: "There are no orders to export.",
      });
      return;
    }

    const headers = ["Order ID", "Date", "Status", "Vendor", "Items", "Products", "Total (R)"];
    
    const rows = dataToExport.map((order) => [
      order.id.slice(0, 8).toUpperCase(),
      format(new Date(order.date), "yyyy-MM-dd"),
      order.status.replace(/_/g, " "),
      order.vendor,
      order.items.toString(),
      order.products.map((p) => `${p.name} x${p.quantity}`).join("; "),
      order.total.toFixed(2),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `order-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${dataToExport.length} orders to CSV.`,
    });
  };

  // Export to PDF
  const exportToPDF = () => {
    const dataToExport = filteredOrders.length > 0 ? filteredOrders : orders;
    
    if (dataToExport.length === 0) {
      toast({
        variant: "destructive",
        title: "No data to export",
        description: "There are no orders to export.",
      });
      return;
    }

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text("Order History", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${format(new Date(), "PPP 'at' p")}`, 14, 30);
    doc.text(`Total Orders: ${dataToExport.length}`, 14, 36);
    
    // Summary stats
    const totalSpent = dataToExport
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total, 0);
    doc.text(`Total Spent: R${totalSpent.toFixed(2)}`, 14, 42);

    // Table data
    const tableData = dataToExport.map((order) => [
      order.id.slice(0, 8).toUpperCase(),
      format(new Date(order.date), "dd MMM yyyy"),
      order.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      order.vendor.length > 20 ? order.vendor.slice(0, 20) + "..." : order.vendor,
      order.items.toString(),
      `R${order.total.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 50,
      head: [["Order ID", "Date", "Status", "Vendor", "Items", "Total"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [245, 158, 11],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 25 },
        1: { cellWidth: 28 },
        2: { cellWidth: 30 },
        3: { cellWidth: 45 },
        4: { cellWidth: 15, halign: "center" },
        5: { cellWidth: 25, halign: "right", fontStyle: "bold" },
      },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );
      doc.text(
        "1145 Lifestyle - Order History Report",
        14,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`order-history-${format(new Date(), "yyyy-MM-dd")}.pdf`);

    toast({
      title: "Export Complete",
      description: `Exported ${dataToExport.length} orders to PDF.`,
    });
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Order Cancelled",
        description: "Your order has been cancelled successfully",
      });

      fetchOrders();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to cancel order",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Order History</h2>
            <p className="text-muted-foreground">View and track your recent orders</p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" disabled={orders.length === 0}>
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPDF} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={fetchOrders} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{orderStats.activeOrders}</p>
                  <p className="text-xs text-muted-foreground">Active Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Truck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{orderStats.deliveredOrders}</p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <ShoppingBag className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">R{orderStats.totalSpent.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Total Spent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders by ID, vendor, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">
              {orders.length === 0 ? "No Orders Yet" : "No Matching Orders"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {orders.length === 0
                ? "Your orders will appear here once you make a purchase."
                : "Try adjusting your search or filter to find what you're looking for."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {paginatedOrders.map((order) => (
            <Card
              key={order.id}
              className="overflow-hidden hover:shadow-md transition-shadow"
            >
              <CardContent className="p-0">
                <div className="flex flex-col lg:flex-row">
                  {/* Product Thumbnails */}
                  <div className="p-4 bg-muted/30 flex items-center gap-2 lg:w-48 lg:flex-col lg:justify-center">
                    <div className="flex -space-x-3">
                      {order.products.slice(0, 3).map((product, idx) => (
                        <div
                          key={idx}
                          className="w-12 h-12 rounded-lg border-2 border-background overflow-hidden bg-muted flex-shrink-0"
                        >
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
                      {order.products.length > 3 && (
                        <div className="w-12 h-12 rounded-lg border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                          +{order.products.length - 3}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground lg:mt-2">
                      {order.items} item{order.items !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Order Details */}
                  <div className="flex-1 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm font-mono">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{format(new Date(order.date), "MMM d, yyyy")}</span>
                          <span className="text-muted-foreground/50">•</span>
                          <span>{formatDistanceToNow(new Date(order.date), { addSuffix: true })}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          from <span className="font-medium text-foreground">{order.vendor}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">R{order.total.toFixed(2)}</p>
                        {order.trackingNumber && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Truck className="h-3 w-3" />
                            <span className="font-mono">{order.trackingNumber.slice(0, 12)}...</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Product Names Preview */}
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {order.products.map((p) => p.name).join(", ")}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4 flex-wrap">
                      {canTrack(order.status) && (
                        <Button
                          size="sm"
                          onClick={() => handleTrackOrder(order)}
                          className="gap-1.5"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          Track
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(order)}
                        className="gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Details
                      </Button>
                      {canReturn(order.status) && (
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <RotateCcw className="h-3.5 w-3.5" />
                          Return
                        </Button>
                      )}
                      {canCancel(order.status) && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancelOrder(order.id)}
                          className="gap-1.5"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * ORDERS_PER_PAGE + 1}-
                {Math.min(currentPage * ORDERS_PER_PAGE, filteredOrders.length)} of{" "}
                {filteredOrders.length} orders
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <OrderTrackingDialog
        order={selectedOrder}
        open={trackingDialogOpen}
        onOpenChange={setTrackingDialogOpen}
      />

      <OrderDetailsModal
        order={selectedOrder}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
      />
    </div>
  );
};

export default ConsumerOrders;
