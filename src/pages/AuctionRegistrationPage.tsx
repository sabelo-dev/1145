import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Gavel, CreditCard, Building2, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";

interface AuctionDetails {
  id: string;
  registration_fee: number;
  product: {
    name: string;
    product_images: { image_url: string }[];
  };
}

const AuctionRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const auctionId = searchParams.get("auctionId");
  
  const [auction, setAuction] = useState<AuctionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "eft">("card");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate(`/login?redirect=/auction-registration?auctionId=${auctionId}`);
      return;
    }
    
    if (!auctionId) {
      navigate("/auctions");
      return;
    }

    fetchAuctionDetails();
  }, [user, auctionId]);

  const fetchAuctionDetails = async () => {
    if (!auctionId || !user) return;
    
    try {
      // Check if already registered
      const { data: existingReg } = await supabase
        .from("auction_registrations")
        .select("*")
        .eq("auction_id", auctionId)
        .eq("user_id", user.id)
        .eq("payment_status", "paid")
        .maybeSingle();

      if (existingReg) {
        setAlreadyRegistered(true);
        setLoading(false);
        return;
      }

      // Fetch auction details
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          id,
          registration_fee,
          product:products(name, product_images(image_url))
        `)
        .eq("id", auctionId)
        .single();

      if (error) throw error;
      setAuction(data as unknown as AuctionDetails);
    } catch (error: any) {
      console.error("Error fetching auction:", error);
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
    if (!user || !auction) return;
    
    setProcessing(true);
    
    try {
      // Create pending registration first
      const { data: registration, error: regError } = await supabase
        .from("auction_registrations")
        .upsert({
          auction_id: auction.id,
          user_id: user.id,
          registration_fee_paid: auction.registration_fee,
          payment_status: "pending",
        }, { onConflict: "auction_id,user_id" })
        .select()
        .single();

      if (regError) throw regError;

      // Invoke PayFast payment
      const { data: paymentData, error } = await supabase.functions.invoke('payfast-payment', {
        body: {
          amount: auction.registration_fee,
          itemName: `Auction Registration: ${auction.product?.name || 'Auction Item'}`,
          returnUrl: `${window.location.origin}/auction-registration/success?auctionId=${auction.id}&registrationId=${registration.id}`,
          cancelUrl: `${window.location.origin}/auction-registration?auctionId=${auction.id}`,
          notifyUrl: `${window.location.origin}/api/auction/registration-notify`,
          customerEmail: user.email,
          customStr1: registration.id, // Pass registration ID for webhook
          customStr2: "auction_registration",
        },
      });

      if (error) throw error;

      if (paymentData?.redirectUrl) {
        window.location.href = paymentData.redirectUrl;
      } else {
        throw new Error("No payment URL received");
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

  if (alreadyRegistered) {
    return (
      <div className="min-h-screen bg-background py-12">
        <SEO title="Already Registered" />
        <div className="max-w-lg mx-auto px-4">
          <Card className="text-center">
            <CardContent className="pt-8 pb-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Already Registered</h2>
              <p className="text-muted-foreground mb-6">
                You're already registered for this auction and can start bidding!
              </p>
              <Button onClick={() => navigate("/auctions")} className="w-full">
                <Gavel className="mr-2 h-4 w-4" />
                Go to Auctions
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!auction) {
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

  const productImage = auction.product?.product_images?.[0]?.image_url;

  return (
    <div className="min-h-screen bg-background py-12">
      <SEO 
        title="Register for Auction" 
        description="Complete your auction registration payment to start bidding"
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
          {/* Auction Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5" />
                Auction Registration
              </CardTitle>
              <CardDescription>
                Pay the registration fee to participate in this auction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {productImage && (
                  <img
                    src={productImage}
                    alt={auction.product?.name}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {auction.product?.name || "Auction Item"}
                  </h3>
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Registration Fee</p>
                    <p className="text-2xl font-bold text-primary">
                      R{auction.registration_fee?.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <h4 className="font-medium mb-2">Important Information:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Registration fee is required to place bids</li>
                  <li>• If you win, this fee becomes your deposit</li>
                  <li>• If you don't win, the fee is non-refundable</li>
                  <li>• You can bid on this auction immediately after payment</li>
                </ul>
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
                <div className="flex justify-between items-center mb-4">
                  <span className="font-medium">Total to Pay</span>
                  <span className="text-2xl font-bold">
                    R{auction.registration_fee?.toFixed(2)}
                  </span>
                </div>
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
                      Pay R{auction.registration_fee?.toFixed(2)} & Register
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AuctionRegistrationPage;
