import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Eye, Mail, Package, Truck, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

interface Order {
  id: string;
  fullId: string;
  customerName: string;
  customerEmail: string;
  date: string;
  status: "pending" | "processing" | "shipped" | "in_transit" | "out_for_delivery" | "delivered" | "cancelled";
  total: number;
  items: number;
  trackingNumber: string | null;
  courierCompany: string | null;
  estimatedDelivery: string | null;
  orderItems: OrderItem[];
  shippingAddress: any;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", icon: Clock },
  { value: "processing", label: "Processing", icon: RefreshCw },
  { value: "shipped", label: "Shipped", icon: Package },
  { value: "in_transit", label: "In Transit", icon: Truck },
  { value: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { value: "delivered", label: "Delivered", icon: CheckCircle },
  { value: "cancelled", label: "Cancelled", icon: XCircle },
];

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [courierCompany, setCourierCompany] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const fetchOrders = async () => {
    try {
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            id,
            quantity,
            price,
            products(name, product_images(image_url, position))
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user profiles for customer names and emails
      const userIds = ordersData?.map(order => order.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, { name: p.name, email: p.email }]) || []);

      const formattedOrders: Order[] = ordersData?.map(order => {
        const profile = profileMap.get(order.user_id) || { name: 'Unknown Customer', email: '' };
        
        const orderItems: OrderItem[] = (order.order_items || []).map((item: any) => {
          const images = item.products?.product_images || [];
          const sortedImages = [...images].sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
          return {
            id: item.id,
            product_name: item.products?.name || 'Unknown Product',
            quantity: item.quantity,
            price: Number(item.price),
            image_url: sortedImages[0]?.image_url,
          };
        });

        return {
          id: order.id.slice(0, 8),
          fullId: order.id,
          customerName: profile.name || 'Unknown Customer',
          customerEmail: profile.email || '',
          date: order.created_at,
          status: order.status as any,
          total: parseFloat(order.total?.toString() || '0'),
          items: orderItems.reduce((sum, item) => sum + item.quantity, 0),
          trackingNumber: order.tracking_number,
          courierCompany: order.courier_company,
          estimatedDelivery: order.estimated_delivery,
          orderItems,
          shippingAddress: order.shipping_address,
        };
      }) || [];

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load orders."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = statusFilter === "all" 
    ? orders 
    : orders.filter(order => order.status === statusFilter);

  const generateTrackingNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ADM-TRK-${timestamp}-${random}`;
  };

  const sendOrderStatusEmail = async (order: Order, status: string, tracking?: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-order-status-email', {
        body: {
          orderId: order.fullId,
          newStatus: status,
          customerEmail: order.customerEmail,
          customerName: order.customerName,
          trackingNumber: tracking || order.trackingNumber,
          courierCompany: courierCompany || order.courierCompany,
          estimatedDelivery: order.estimatedDelivery,
          siteUrl: window.location.origin
        }
      });

      if (error) {
        console.error('Failed to send status email:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error sending order status email:', error);
      return false;
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;

    setUpdating(true);

    try {
      let finalTrackingNumber = trackingNumber;
      
      // Auto-generate tracking number if shipping and none provided
      if (newStatus === 'shipped' && !trackingNumber && !selectedOrder.trackingNumber) {
        finalTrackingNumber = generateTrackingNumber();
      }

      const updateData: any = { status: newStatus };
      
      if (finalTrackingNumber) {
        updateData.tracking_number = finalTrackingNumber;
      }
      if (courierCompany) {
        updateData.courier_company = courierCompany;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', selectedOrder.fullId);

      if (error) throw error;

      // Send email notification
      const emailSent = await sendOrderStatusEmail(selectedOrder, newStatus, finalTrackingNumber);

      // Update local state
      setOrders(orders.map((order) =>
        order.fullId === selectedOrder.fullId 
          ? { 
              ...order, 
              status: newStatus as any, 
              trackingNumber: finalTrackingNumber || order.trackingNumber,
              courierCompany: courierCompany || order.courierCompany
            } 
          : order
      ));

      toast({
        title: "Order Updated",
        description: emailSent 
          ? `Order status updated to ${newStatus}. Email notification sent.`
          : `Order status updated to ${newStatus}. Email notification failed.`,
      });

      setUpdateDialogOpen(false);
      setNewStatus("");
      setTrackingNumber("");
      setCourierCompany("");
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update order status."
      });
    } finally {
      setUpdating(false);
    }
  };

  const openUpdateDialog = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setTrackingNumber(order.trackingNumber || "");
    setCourierCompany(order.courierCompany || "");
    setUpdateDialogOpen(true);
  };

  const openDetailsDialog = (order: Order) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      pending: { variant: "secondary" },
      processing: { variant: "default", className: "bg-blue-500" },
      shipped: { variant: "outline", className: "border-amber-500 text-amber-600" },
      in_transit: { variant: "default", className: "bg-amber-500" },
      out_for_delivery: { variant: "default", className: "bg-purple-500" },
      delivered: { variant: "default", className: "bg-green-500" },
      cancelled: { variant: "destructive" },
    };

    const { variant, className } = config[status] || { variant: "secondary" };

    return (
      <Badge variant={variant} className={className}>
        {status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">Loading orders...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Order Management</h2>
        <Button variant="outline" size="sm" onClick={fetchOrders}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {["all", "pending", "processing", "shipped", "in_transit", "delivered", "cancelled"].map((status) => (
          <Button 
            key={status}
            variant={statusFilter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(status)}
          >
            {status === "all" ? "All" : status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </Button>
        ))}
      </div>

      <Table>
        <TableCaption>List of all orders ({filteredOrders.length})</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredOrders.map((order) => (
            <TableRow key={order.fullId}>
              <TableCell className="font-medium font-mono">{order.id}</TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{order.customerName}</div>
                  <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                </div>
              </TableCell>
              <TableCell>{format(new Date(order.date), "PP")}</TableCell>
              <TableCell>{getStatusBadge(order.status)}</TableCell>
              <TableCell>{formatCurrency(order.total)}</TableCell>
              <TableCell>{order.items}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openDetailsDialog(order)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openUpdateDialog(order)}
                >
                  Update Status
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Order #{selectedOrder?.id}</span>
              {selectedOrder && getStatusBadge(selectedOrder.status)}
            </DialogTitle>
            <DialogDescription>
              {selectedOrder && format(new Date(selectedOrder.date), "PPP 'at' p")}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Customer</h4>
                <p className="font-medium">{selectedOrder.customerName}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customerEmail}</p>
              </div>

              {/* Shipping Address */}
              {selectedOrder.shippingAddress && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Shipping Address</h4>
                  <p>{selectedOrder.shippingAddress.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.shippingAddress.street}<br />
                    {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.province} {selectedOrder.shippingAddress.postal_code}<br />
                    {selectedOrder.shippingAddress.country}
                  </p>
                </div>
              )}

              {/* Order Items */}
              <div>
                <h4 className="font-semibold mb-3">Order Items</h4>
                <div className="space-y-3">
                  {selectedOrder.orderItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="w-12 h-12 rounded bg-muted flex-shrink-0 overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tracking Info */}
              {selectedOrder.trackingNumber && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Tracking</h4>
                  <p className="font-mono">{selectedOrder.trackingNumber}</p>
                  {selectedOrder.courierCompany && (
                    <p className="text-sm text-muted-foreground">Courier: {selectedOrder.courierCompany}</p>
                  )}
                </div>
              )}

              {/* Total */}
              <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold">{formatCurrency(selectedOrder.total)}</span>
              </div>

              <Button className="w-full" onClick={() => {
                setDetailsOpen(false);
                openUpdateDialog(selectedOrder);
              }}>
                <Mail className="h-4 w-4 mr-2" />
                Update Status & Send Notification
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Update order #{selectedOrder?.id} and send email notification to customer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(newStatus === "shipped" || newStatus === "in_transit") && (
              <>
                <div className="space-y-2">
                  <Label>Tracking Number</Label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Leave empty to auto-generate"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Courier Company</Label>
                  <Input
                    value={courierCompany}
                    onChange={(e) => setCourierCompany(e.target.value)}
                    placeholder="e.g., DHL, FedEx, Aramex"
                  />
                </div>
              </>
            )}

            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Email Notification</p>
              <p className="text-muted-foreground">
                An email will be sent to <strong>{selectedOrder?.customerEmail}</strong> with the updated status
                {trackingNumber && " and tracking information"}.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateStatus} disabled={updating || !newStatus}>
                {updating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Update & Notify
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
