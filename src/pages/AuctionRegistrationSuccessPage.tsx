import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Gavel, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";

const AuctionRegistrationSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const auctionId = searchParams.get("auctionId");
  const registrationId = searchParams.get("registrationId");
  
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user || !auctionId || !registrationId) {
      navigate("/auctions");
      return;
    }

    confirmRegistration();
  }, [user, auctionId, registrationId]);

  const confirmRegistration = async () => {
    try {
      // Update registration status to paid
      const { error } = await supabase
        .from("auction_registrations")
        .update({ payment_status: "paid" })
        .eq("id", registrationId)
        .eq("user_id", user?.id);

      if (error) throw error;

      setSuccess(true);
      toast({
        title: "Registration Complete!",
        description: "You can now start bidding on this auction.",
      });
    } catch (error: any) {
      console.error("Error confirming registration:", error);
      toast({
        title: "Error",
        description: "Failed to confirm registration. Please contact support.",
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
          <p className="text-lg text-muted-foreground">Confirming your registration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <SEO title="Registration Successful" />
      <div className="max-w-lg mx-auto px-4">
        <Card className="text-center">
          <CardContent className="pt-8 pb-6">
            {success ? (
              <>
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Registration Successful!</h2>
                <p className="text-muted-foreground mb-6">
                  Your payment has been processed and you're now registered for this auction.
                  You can start placing bids immediately!
                </p>
                <div className="space-y-3">
                  <Button 
                    onClick={() => navigate("/auctions")} 
                    className="w-full"
                    size="lg"
                  >
                    <Gavel className="mr-2 h-5 w-5" />
                    Start Bidding Now
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="w-full"
                  >
                    Go to Homepage
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
                <p className="text-muted-foreground mb-6">
                  We couldn't confirm your registration. If you were charged, please contact support.
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

export default AuctionRegistrationSuccessPage;
