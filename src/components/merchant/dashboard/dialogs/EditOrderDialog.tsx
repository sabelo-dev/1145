import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EditOrderDialogProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
}

const EditOrderDialog: React.FC<EditOrderDialogProps> = ({
  order,
  open,
  onOpenChange,
  onOrderUpdated,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    street: order?.shippingAddress?.street || "",
    city: order?.shippingAddress?.city || "",
    state: order?.shippingAddress?.state || "",
    zipCode: order?.shippingAddress?.zipCode || "",
    country: order?.shippingAddress?.country || "",
    notes: order?.notes || "",
    courierName: order?.courierName || "",
    courierPhone: order?.courierPhone || "",
    courierCompany: order?.courierCompany || "",
    estimatedDelivery: order?.estimatedDelivery || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          shipping_address: {
            street: formData.street,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            country: formData.country,
          },
          notes: formData.notes,
          courier_name: formData.courierName,
          courier_phone: formData.courierPhone,
          courier_company: formData.courierCompany,
          estimated_delivery: formData.estimatedDelivery || null,
        })
        .eq("id", order.id);

      if (error) throw error;

      toast({
        title: "Order Updated",
        description: "Order details have been updated successfully.",
      });

      onOrderUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update order details.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order Details</DialogTitle>
          <DialogDescription>
            Update shipping address, delivery information, and order notes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Shipping Address */}
          <div className="space-y-4">
            <h3 className="font-medium">Shipping Address</h3>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={formData.street}
                  onChange={(e) =>
                    setFormData({ ...formData, street: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="zipCode">ZIP/Postal Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) =>
                      setFormData({ ...formData, zipCode: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Courier Information */}
          <div className="space-y-4">
            <h3 className="font-medium">Courier Information</h3>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="courierCompany">Courier Company</Label>
                <Input
                  id="courierCompany"
                  value={formData.courierCompany}
                  onChange={(e) =>
                    setFormData({ ...formData, courierCompany: e.target.value })
                  }
                  placeholder="e.g., DHL, FedEx, Local Courier"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="courierName">Courier Name</Label>
                  <Input
                    id="courierName"
                    value={formData.courierName}
                    onChange={(e) =>
                      setFormData({ ...formData, courierName: e.target.value })
                    }
                    placeholder="Driver/Agent name"
                  />
                </div>
                <div>
                  <Label htmlFor="courierPhone">Courier Phone</Label>
                  <Input
                    id="courierPhone"
                    type="tel"
                    value={formData.courierPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, courierPhone: e.target.value })
                    }
                    placeholder="Contact number"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="estimatedDelivery">Estimated Delivery Date</Label>
                <Input
                  id="estimatedDelivery"
                  type="date"
                  value={formData.estimatedDelivery}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      estimatedDelivery: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Order Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Add internal notes about this order..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;
