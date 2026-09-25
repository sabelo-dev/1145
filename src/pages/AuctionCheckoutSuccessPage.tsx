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
      // PayFast's ITN (payfast-itn) completes the auction and creates the order
      // server-side once payment is verified. Wait for that instead of writing
      // payment state from the browser.
      let completed = false;
      for (let attempt = 0; attempt < 10 && !completed; attempt++) {
        const { data: auction, error } = await supabase
          .from("auctions")
          .select("status")
          .eq("id", auctionId)
          .eq("winner_id", user?.id)
          .maybeSingle();

        if (error) throw error;
        completed = auction?.status === "completed";
        if (!completed) await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      if (!completed) throw new Error("Payment not yet confirmed by PayFast");

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
                  We haven't received payment confirmation from PayFast yet. It can take a few minutes —
                  check your orders shortly. If you were charged and no order appears, please contact support.
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
