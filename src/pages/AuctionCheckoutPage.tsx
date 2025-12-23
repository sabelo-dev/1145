import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Trophy, CreditCard, Building2, Loader2, CheckCircle, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";

interface AuctionWinDetails {
  auction: {
    id: string;
    winning_bid: number;
    product: {
      name: string;
      description: string;
      product_images: { image_url: string }[];
    };
  };
  registration: {
    id: string;
    registration_fee_paid: number;
    deposit_applied: boolean;
  };
}

const AuctionCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const auctionId = searchParams.get("auctionId");
  
  const [winDetails, setWinDetails] = useState<AuctionWinDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "eft">("card");
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate(`/login?redirect=/auction-checkout?auctionId=${auctionId}`);
      return;
    }
    
    if (!auctionId) {
      navigate("/auctions");
      return;
    }

    fetchWinDetails();
  }, [user, auctionId]);

  const fetchWinDetails = async () => {
    if (!auctionId || !user) return;
    
    try {
      // Fetch auction details
      const { data: auction, error: auctionError } = await supabase
        .from("auctions")
        .select(`
          id,
          winning_bid,
          winner_id,
          status,
          product:products(name, description, product_images(image_url))
        `)
        .eq("id", auctionId)
        .single();

      if (auctionError) throw auctionError;

      // Verify user is the winner
      if (auction.winner_id !== user.id) {
        toast({
          title: "Access Denied",
          description: "You are not the winner of this auction.",
          variant: "destructive",
        });
        navigate("/auctions");
        return;
      }

      // Check if already paid
      if (auction.status === "completed") {
        setAlreadyPaid(true);
        setLoading(false);
        return;
      }

      // Fetch user's registration
      const { data: registration, error: regError } = await supabase
        .from("auction_registrations")
        .select("*")
        .eq("auction_id", auctionId)
        .eq("user_id", user.id)
        .single();

      if (regError) throw regError;

      setWinDetails({
        auction: auction as any,
        registration,
      });
    } catch (error: any) {
      console.error("Error fetching win details:", error);
      toast({
        title: "Error",
        description: "Failed to load auction details",
        variant: "destructive",
      });
      navigate("/auctions");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!user || !winDetails) return;
    
    setProcessing(true);
    
    const { auction, registration } = winDetails;
    const depositAmount = registration.registration_fee_paid;
    const remainingAmount = auction.winning_bid - depositAmount;
    
    try {
      // Invoke PayFast payment
      const { data: paymentData, error } = await supabase.functions.invoke('payfast-payment', {
        body: {
          amount: remainingAmount,
          itemName: `Auction Win: ${auction.product?.name || 'Auction Item'}`,
          returnUrl: `${window.location.origin}/auction-checkout/success?auctionId=${auction.id}`,
          cancelUrl: `${window.location.origin}/auction-checkout?auctionId=${auction.id}`,
          notifyUrl: `https://hipomusjocacncjsvgfa.supabase.co/functions/v1/payfast-itn`,
          customerEmail: user.email,
          customStr1: auction.id,
          customStr2: "auction_winner_payment",
        },
      });

      if (error) throw error;

      if (paymentData?.formData && paymentData?.action) {
        // Create and submit form to PayFast
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = paymentData.action;
        
        Object.entries(paymentData.formData).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value as string;
          form.appendChild(input);
        });
        
        document.body.appendChild(form);
        form.submit();
      } else {
        throw new Error("No payment data received");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
      setProcessing(false);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (alreadyPaid) {
    return (
      <div className="min-h-screen bg-background py-12">
        <SEO title="Payment Complete" />
        <div className="max-w-lg mx-auto px-4">
          <Card className="text-center">
            <CardContent className="pt-8 pb-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Payment Already Completed</h2>
              <p className="text-muted-foreground mb-6">
                You've already completed the payment for this auction. Check your orders for details.
              </p>
              <Button onClick={() => navigate("/consumer/dashboard")} className="w-full">
                <Package className="mr-2 h-4 w-4" />
                View My Orders
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!winDetails) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-lg mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Auction Not Found</h2>
          <Button onClick={() => navigate("/auctions")}>
            Back to Auctions
          </Button>
        </div>
      </div>
    );
  }

  const { auction, registration } = winDetails;
  const depositAmount = registration.registration_fee_paid;
  const remainingAmount = auction.winning_bid - depositAmount;
  const productImage = auction.product?.product_images?.[0]?.image_url;

  return (
    <div className="min-h-screen bg-background py-12">
      <SEO 
        title="Complete Your Auction Purchase" 
        description="Complete payment for your winning auction bid"
      />
      <div className="max-w-2xl mx-auto px-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/auctions")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Auctions
        </Button>

        <div className="grid gap-6">
          {/* Winner Banner */}
          <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-green-700 dark:text-green-400">
                    Congratulations, You Won!
                  </h2>
                  <p className="text-green-600 dark:text-green-500">
                    Complete your payment to receive your item
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Item Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
              <CardDescription>
                Your winning auction item
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {productImage && (
                  <img
                    src={productImage}
                    alt={auction.product?.name}
                    className="w-28 h-28 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {auction.product?.name || "Auction Item"}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {auction.product?.description}
                  </p>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              {/* Payment Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between text-base">
                  <span>Winning Bid</span>
                  <span className="font-medium">R{auction.winning_bid?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base text-green-600">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Registration Deposit Applied
                  </span>
                  <span className="font-medium">-R{depositAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-xl font-bold">
                  <span>Amount Due</span>
                  <span className="text-primary">R{remainingAmount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as "card" | "eft")}
              >
                <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="card" id="card" />
                  <Label htmlFor="card" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Card Payment</p>
                        <p className="text-sm text-muted-foreground">
                          Pay securely with credit or debit card
                        </p>
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="eft" id="eft" />
                  <Label htmlFor="eft" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">EFT / Bank Transfer</p>
                        <p className="text-sm text-muted-foreground">
                          Pay via instant EFT
                        </p>
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              <div className="pt-4 border-t">
                <Button
                  onClick={handlePayment}
                  disabled={processing}
                  className="w-full"
                  size="lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Pay R{remainingAmount.toFixed(2)} Now
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-3">
                  Secure payment powered by PayFast
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AuctionCheckoutPage;
