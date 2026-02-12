import React, { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { Clock, Package, Truck, CheckCircle, MapPin, User, Phone } from "lucide-react";

interface OrderDetailsDialogProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({
  orderId,
  open,
  onOpenChange,
}) => {
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && orderId) {
      fetchOrderHistory();
    }
  }, [open, orderId]);

  const fetchOrderHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("order_history")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrderHistory(data || []);
    } catch (error) {
      console.error("Error fetching order history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "processing":
        return <Package className="h-4 w-4" />;
      case "shipped":
        return <Truck className="h-4 w-4" />;
      case "delivered":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Timeline & History</DialogTitle>
          <DialogDescription>
            View complete order history and status changes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8">Loading order history...</div>
          ) : orderHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No history available for this order.
            </div>
          ) : (
            <div className="space-y-4">
              {orderHistory.map((entry, index) => (
                <div key={entry.id} className="relative">
                  {index !== orderHistory.length - 1 && (
                    <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
                  )}
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background">
                      {getActionIcon(entry.action)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium capitalize">{entry.action}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(entry.created_at)}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {entry.details?.new?.status || "Updated"}
                        </Badge>
                      </div>
                      {entry.details?.new && (
                        <div className="space-y-2 text-sm">
                          {entry.details.new.courier_name && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <User className="h-4 w-4" />
                              <span>Courier: {entry.details.new.courier_name}</span>
                            </div>
                          )}
                          {entry.details.new.tracking_number && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Package className="h-4 w-4" />
                              <span>Tracking: {entry.details.new.tracking_number}</span>
                            </div>
                          )}
                          {entry.details.new.notes && (
                            <div className="p-3 bg-muted rounded-md">
                              <p className="text-xs font-medium mb-1">Notes:</p>
                              <p className="text-muted-foreground">
                                {entry.details.new.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;
