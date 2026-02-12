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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RefundReturnDialogProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated: () => void;
}

const RefundReturnDialog: React.FC<RefundReturnDialogProps> = ({
  order,
  open,
  onOpenChange,
  onOrderUpdated,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [refundData, setRefundData] = useState({
    amount: order?.total || "",
    reason: "",
    status: "approved",
  });
  const [returnData, setReturnData] = useState({
    reason: "",
    status: "approved",
  });

  const handleRefund = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          refund_status: refundData.status,
          refund_amount: parseFloat(refundData.amount),
          refund_reason: refundData.reason,
        })
        .eq("id", order.id);

      if (error) throw error;

      toast({
        title: "Refund Processed",
        description: `Refund of R${refundData.amount} has been ${refundData.status}.`,
      });

      onOrderUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error processing refund:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process refund.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          return_status: returnData.status,
          return_reason: returnData.reason,
        })
        .eq("id", order.id);

      if (error) throw error;

      toast({
        title: "Return Processed",
        description: `Return request has been ${returnData.status}.`,
      });

      onOrderUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error processing return:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process return.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Refunds & Returns</DialogTitle>
          <DialogDescription>
            Process refund or return requests for order {order?.id}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="refund" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="refund">Refund</TabsTrigger>
            <TabsTrigger value="return">Return</TabsTrigger>
          </TabsList>

          <TabsContent value="refund" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="refund-amount">Refund Amount</Label>
                <Input
                  id="refund-amount"
                  type="number"
                  step="0.01"
                  value={refundData.amount}
                  onChange={(e) =>
                    setRefundData({ ...refundData, amount: e.target.value })
                  }
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="refund-status">Status</Label>
                <Select
                  value={refundData.status}
                  onValueChange={(value) =>
                    setRefundData({ ...refundData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                    <SelectItem value="completed">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="refund-reason">Reason</Label>
                <Textarea
                  id="refund-reason"
                  value={refundData.reason}
                  onChange={(e) =>
                    setRefundData({ ...refundData, reason: e.target.value })
                  }
                  placeholder="Explain the reason for this refund..."
                  rows={4}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleRefund} disabled={loading}>
                {loading ? "Processing..." : "Process Refund"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="return" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="return-status">Status</Label>
                <Select
                  value={returnData.status}
                  onValueChange={(value) =>
                    setReturnData({ ...returnData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                    <SelectItem value="completed">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="return-reason">Reason</Label>
                <Textarea
                  id="return-reason"
                  value={returnData.reason}
                  onChange={(e) =>
                    setReturnData({ ...returnData, reason: e.target.value })
                  }
                  placeholder="Explain the reason for this return..."
                  rows={4}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleReturn} disabled={loading}>
                {loading ? "Processing..." : "Process Return"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default RefundReturnDialog;
