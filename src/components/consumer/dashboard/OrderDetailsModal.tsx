import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import {
  Package,
  Truck,
  MapPin,
  CheckCircle,
  Clock,
  Navigation,
  ShoppingBag,
  FileText,
  Download,
  CreditCard,
  Info,
} from "lucide-react";
import { generateInvoice } from "@/lib/invoiceGenerator";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
  payment_method?: string | null;
  shipping_method?: string | null;
  payment_status?: string | null;
  notes?: string | null;
}

interface OrderDetailsModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  open,
  onOpenChange,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  if (!order) return null;

  const handleDownloadInvoice = () => {
    try {
      generateInvoice({
        orderId: order.id,
        orderDate: order.date,
        customerName: order.shipping_address?.name || "Customer",
        customerEmail: user?.email,
        shippingAddress: order.shipping_address || {},
        products: order.products.map((p) => ({
          name: p.name,
          quantity: p.quantity,
          price: p.price,
        })),
        total: order.total,
        trackingNumber: order.trackingNumber || undefined,
        courierCompany: order.courier_company || undefined,
        estimatedDelivery: order.estimated_delivery || undefined,
        storeName: order.vendor,
        orderStatus: order.status,
      });

      toast({
        title: "Invoice Downloaded",
        description: "Your invoice has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate invoice. Please try again.",
      });
    }
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

  const getTimelineSteps = () => {
    const orderStatus = order.status;

    const steps = [
      { id: "ordered", label: "Order Placed", icon: Package, completed: true },
      { id: "processing", label: "Processing", icon: Clock, completed: ["processing", "shipped", "in_transit", "out_for_delivery", "delivered"].includes(orderStatus) },
      { id: "shipped", label: "Shipped", icon: Truck, completed: ["shipped", "in_transit", "out_for_delivery", "delivered"].includes(orderStatus) },
      { id: "in_transit", label: "In Transit", icon: Navigation, completed: ["in_transit", "out_for_delivery", "delivered"].includes(orderStatus) },
      { id: "delivered", label: "Delivered", icon: CheckCircle, completed: orderStatus === "delivered" },
    ];

    return steps;
  };

  const timelineSteps = getTimelineSteps();
  const currentStepIndex = timelineSteps.findIndex((step) => !step.completed);

  const subtotal = order.products.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const vat = order.total - subtotal > 0 ? order.total - subtotal : order.total * 0.15;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Order #{order.id.slice(0, 8)}
            </span>
            {getStatusBadge(order.status)}
          </DialogTitle>
          <div className="flex items-center justify-between">
            <DialogDescription>
              Placed on {format(new Date(order.date), "PPP 'at' p")}
            </DialogDescription>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadInvoice}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download Invoice
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Progress Timeline */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">Order Progress</h3>
            <div className="flex justify-between items-center">
              {timelineSteps.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStepIndex === index;
                const isCompleted = step.completed;
                const isLast = index === timelineSteps.length - 1;

                return (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center text-center">
                      <div
                        className={`
                          flex items-center justify-center w-10 h-10 rounded-full border-2 mb-2
                          ${isCompleted ? "bg-green-500 border-green-500 text-white" : 
                            isActive ? "bg-primary border-primary text-primary-foreground animate-pulse" : 
                            "bg-muted border-muted-foreground/30 text-muted-foreground"}
                        `}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`text-xs ${isCompleted ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Order Items with Thumbnails */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Items Ordered ({order.products.length})
            </h3>
            <div className="space-y-3">
              {order.products.map((product, index) => (
                <div
                  key={product.id || index}
                  className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{product.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Qty: {product.quantity} × R{product.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="font-semibold">
                    R{(product.price * product.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Shipping Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Delivery Address */}
            {order.shipping_address && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  Delivery Address
                </h3>
                <div className="text-sm">
                  <p className="font-medium">{order.shipping_address.name}</p>
                  <p className="text-muted-foreground">
                    {order.shipping_address.street}<br />
                    {order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.postal_code}<br />
                    {order.shipping_address.country}
                  </p>
                </div>
              </div>
            )}

            {/* Tracking Info */}
            {order.trackingNumber && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4" />
                  Shipping Details
                </h3>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">Tracking:</span>{" "}
                    <span className="font-mono">{order.trackingNumber}</span>
                  </p>
                  {order.courier_company && (
                    <p>
                      <span className="text-muted-foreground">Courier:</span>{" "}
                      {order.courier_company}
                    </p>
                  )}
                  {order.estimated_delivery && (
                    <p>
                      <span className="text-muted-foreground">Est. Delivery:</span>{" "}
                      {format(new Date(order.estimated_delivery), "PPP")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Payment & Shipping Method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4" />
                Payment
              </h3>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Method:</span>{" "}
                  <span className="capitalize">{order.payment_method?.replace(/_/g, " ") || "Not specified"}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <Badge variant={order.payment_status === "paid" ? "default" : "secondary"} className={order.payment_status === "paid" ? "bg-green-500" : ""}>
                    {(order.payment_status || "pending").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Badge>
                </p>
              </div>
            </div>
            {order.shipping_method && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4" />
                  Shipping Method
                </h3>
                <p className="text-sm capitalize">{order.shipping_method.replace(/_/g, " ")}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <>
              <Separator />
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                  <Info className="h-4 w-4" />
                  Order Notes
                </h3>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Order Summary */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-3 text-sm">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT (15%)</span>
                <span>R{vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>Included</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>R{order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Vendor Info */}
          <div className="text-center text-sm text-muted-foreground">
            Sold by <span className="font-medium">{order.vendor}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsModal;
