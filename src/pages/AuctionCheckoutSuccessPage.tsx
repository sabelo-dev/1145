import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Package, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";

const AuctionCheckoutSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const auctionId = searchParams.get("auctionId");
  
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user || !auctionId) {
      navigate("/auctions");
      return;
    }

    confirmPayment();
  }, [user, auctionId]);

  const confirmPayment = async () => {
    try {
      // Update auction status to completed
      const { error: auctionError } = await supabase
        .from("auctions")
        .update({ status: "completed" })
        .eq("id", auctionId)
        .eq("winner_id", user?.id);

      if (auctionError) throw auctionError;

      // Mark deposit as applied
      const { error: regError } = await supabase
        .from("auction_registrations")
        .update({ deposit_applied: true })
        .eq("auction_id", auctionId)
        .eq("user_id", user?.id);

      if (regError) throw regError;

      // Create order from auction
      const { data: auction } = await supabase
        .from("auctions")
        .select(`
          *,
          product:products(id, name, price, store_id)
        `)
        .eq("id", auctionId)
        .single();

      if (auction) {
        // Get user's default address
        const { data: address } = await supabase
          .from("user_addresses")
          .select("*")
          .eq("user_id", user?.id)
          .eq("is_default", true)
          .maybeSingle();

        const shippingAddress = address ? {
          name: address.name,
          street: address.street,
          city: address.city,
          province: address.province,
          postal_code: address.postal_code,
          country: address.country,
          phone: address.phone,
        } : {};

        // Create the order
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            user_id: user?.id,
            total: auction.winning_bid,
            status: "processing",
            payment_status: "paid",
            payment_method: "payfast",
            shipping_address: shippingAddress,
            notes: `Auction win for ${auction.product?.name}`,
          })
          .select()
          .single();

        if (!orderError && order) {
          // Create order item
          await supabase
            .from("order_items")
            .insert({
              order_id: order.id,
              product_id: auction.product?.id,
              store_id: auction.product?.store_id,
              quantity: 1,
              price: auction.winning_bid,
              status: "pending",
              vendor_status: "pending",
            });
        }
      }

      setSuccess(true);
      toast({
        title: "Payment Successful!",
        description: "Your order has been placed and the seller has been notified.",
      });
    } catch (error: any) {
      console.error("Error confirming payment:", error);
      toast({
        title: "Error",
        description: "Failed to confirm payment. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (processing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Processing your order...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <SEO title="Order Confirmed" />
      <div className="max-w-lg mx-auto px-4">
        <Card className="text-center">
          <CardContent className="pt-8 pb-6">
            {success ? (
              <>
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
                <p className="text-muted-foreground mb-6">
                  Thank you for your purchase! Your order has been placed and the seller has been notified.
                  You'll receive shipping updates via email.
                </p>
                <div className="space-y-3">
                  <Button 
                    onClick={() => navigate("/consumer/dashboard")} 
                    className="w-full"
                    size="lg"
                  >
                    <Package className="mr-2 h-5 w-5" />
                    View My Orders
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => navigate("/auctions")}
                    className="w-full"
                  >
                    Browse More Auctions
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
                <p className="text-muted-foreground mb-6">
                  We couldn't confirm your payment. If you were charged, please contact support.
                </p>
                <Button onClick={() => navigate("/auctions")} className="w-full">
                  Back to Auctions
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuctionCheckoutSuccessPage;
