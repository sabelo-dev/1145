import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Gavel, Clock, Users } from "lucide-react";
import { Auction, AuctionBid, AuctionRegistration } from "@/types/auction";
import { isFuture } from "date-fns";
import SEO from "@/components/SEO";
import AuctionCountdown from "@/components/auction/AuctionCountdown";

const AuctionsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [userRegistration, setUserRegistration] = useState<AuctionRegistration | null>(null);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState("");

  useEffect(() => {
    fetchAuctions();

    // Subscribe to real-time auction updates
    const auctionsChannel = supabase
      .channel('auctions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auctions'
        },
        (payload) => {
          console.log('Auction update:', payload);
          fetchAuctions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(auctionsChannel);
    };
  }, []);

  // Subscribe to bids for selected auction
  useEffect(() => {
    if (!selectedAuction) return;

    const bidsChannel = supabase
      .channel(`auction-bids-${selectedAuction.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auction_bids',
          filter: `auction_id=eq.${selectedAuction.id}`
        },
        async (payload) => {
          console.log('New bid received:', payload);
          
          // Fetch updated bids
          const { data: bidsData } = await supabase
            .from("auction_bids")
            .select(`*, profiles(name, email)`)
            .eq("auction_id", selectedAuction.id)
            .order("bid_amount", { ascending: false });
          
          setBids((bidsData as unknown as AuctionBid[]) || []);

          // Fetch updated auction to get new current_bid
          const { data: auctionData } = await supabase
            .from("auctions")
            .select(`*, product:products(id, name, description, price, store_id, product_images(image_url))`)
            .eq("id", selectedAuction.id)
            .single();

          if (auctionData) {
            setSelectedAuction(auctionData as unknown as Auction);
            // Update minimum bid amount
            const newMinBid = ((auctionData.current_bid || auctionData.starting_bid_price || 0) + 50);
            setBidAmount(newMinBid.toString());
          }

          // Show notification for new bid (if not from current user)
          const newBid = payload.new as AuctionBid;
          if (user && newBid.user_id !== user.id) {
            toast({
              title: "New Bid!",
              description: `Someone placed a bid of R${newBid.bid_amount}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bidsChannel);
    };
  }, [selectedAuction?.id, user]);

  const fetchAuctions = async () => {
    try {
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          *,
          product:products(id, name, description, price, store_id, product_images(image_url))
        `)
        .in("status", ["approved", "active", "unsold"])
        .order("start_date", { ascending: true });

      if (error) throw error;
      setAuctions((data as unknown as Auction[]) || []);
    } catch (error: any) {
      console.error("Error fetching auctions:", error);
    } finally {
      setLoading(false);
    }
  };

  const openBidDialog = async (auction: Auction) => {
    setSelectedAuction(auction);
    setBidAmount(((auction.current_bid || auction.starting_bid_price || 0) + 50).toString());
    
    // Fetch bids
    const { data: bidsData } = await supabase
      .from("auction_bids")
      .select(`*, profiles(name, email)`)
      .eq("auction_id", auction.id)
      .order("bid_amount", { ascending: false });
    
    setBids((bidsData as unknown as AuctionBid[]) || []);

    // Check user registration
    if (user) {
      const { data: regData } = await supabase
        .from("auction_registrations")
        .select("*")
        .eq("auction_id", auction.id)
        .eq("user_id", user.id)
        .single();
      
      setUserRegistration(regData as AuctionRegistration | null);
    }

    setBidDialogOpen(true);
  };

  const handleRegister = async () => {
    if (!user || !selectedAuction) {
      toast({
        title: "Please login",
        description: "You need to be logged in to register for auctions",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("auction_registrations").insert({
        auction_id: selectedAuction.id,
        user_id: user.id,
        registration_fee_paid: selectedAuction.registration_fee,
        payment_status: "paid", // In production, this would go through payment flow
      });

      if (error) throw error;

      toast({
        title: "Registration Successful",
        description: `You've registered for this auction. Registration fee: R${selectedAuction.registration_fee}`,
      });
      
      // Refresh registration status
      const { data: regData } = await supabase
        .from("auction_registrations")
        .select("*")
        .eq("auction_id", selectedAuction.id)
        .eq("user_id", user.id)
        .single();
      
      setUserRegistration(regData as AuctionRegistration | null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePlaceBid = async () => {
    if (!user || !selectedAuction || !userRegistration) return;

    const amount = parseFloat(bidAmount);
    const minBid = (selectedAuction.current_bid || selectedAuction.starting_bid_price || 0) + 1;

    if (amount < minBid) {
      toast({
        title: "Invalid Bid",
        description: `Bid must be at least R${minBid}`,
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("auction_bids").insert({
        auction_id: selectedAuction.id,
        user_id: user.id,
        bid_amount: amount,
      });

      if (error) throw error;

      toast({
        title: "Bid Placed",
        description: `Your bid of R${amount} has been placed`,
      });
      
      // Refresh bids
      const { data: bidsData } = await supabase
        .from("auction_bids")
        .select(`*, profiles(name, email)`)
        .eq("auction_id", selectedAuction.id)
        .order("bid_amount", { ascending: false });
      
      setBids((bidsData as unknown as AuctionBid[]) || []);
      setBidAmount((amount + 50).toString());
      
      // Refresh auction data
      fetchAuctions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleBuyNow = async (auction: Auction) => {
    if (!user) {
      toast({
        title: "Please login",
        description: "You need to be logged in to purchase",
        variant: "destructive",
      });
      return;
    }

    // In production, this would go through checkout
    toast({
      title: "Purchase",
      description: `Proceeding to checkout for R${auction.vendor_base_amount}`,
    });
  };

  const getAuctionStatus = (auction: Auction) => {
    if (auction.status === "unsold") return "buy-now";
    if (auction.status === "active") return "live";
    if (auction.start_date && isFuture(new Date(auction.start_date))) return "upcoming";
    return auction.status;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-8">Loading auctions...</main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <SEO 
        title="Auctions | 1145 Lifestyle"
        description="Bid on exclusive products in our live auctions"
      />
      <main className="flex-1" role="main">
        <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gavel className="h-8 w-8" /> Live Auctions
          </h1>
          <p className="text-muted-foreground mt-2">
            Register and bid on exclusive products
          </p>
        </div>

        {auctions.length === 0 ? (
          <Card className="py-12">
            <CardContent className="text-center">
              <Gavel className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No active auctions at the moment</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auctions.map((auction) => {
              const status = getAuctionStatus(auction);
              const imageUrl = auction.product?.product_images?.[0]?.image_url;
              
              return (
                <Card key={auction.id} className="overflow-hidden">
                  <div className="aspect-square relative bg-muted">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={auction.product?.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Gavel className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                    <Badge 
                      className="absolute top-2 right-2"
                      variant={status === "live" ? "default" : status === "buy-now" ? "secondary" : "outline"}
                    >
                      {status === "live" ? "LIVE" : status === "buy-now" ? "BUY NOW" : "UPCOMING"}
                    </Badge>
                  </div>
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{auction.product?.name}</CardTitle>
                    {auction.start_date && status === "upcoming" && (
                      <AuctionCountdown 
                        targetDate={auction.start_date} 
                        type="start" 
                        compact 
                        className="text-muted-foreground"
                      />
                    )}
                    {status === "live" && auction.end_date && (
                      <AuctionCountdown 
                        targetDate={auction.end_date} 
                        type="end" 
                        compact 
                        className="text-destructive"
                      />
                    )}
                  </CardHeader>
                  <CardContent>
                    {status === "buy-now" ? (
                      <div>
                        <p className="text-sm text-muted-foreground">Buy Now Price</p>
                        <p className="text-2xl font-bold">R{auction.vendor_base_amount}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Current Bid</span>
                          <span className="font-bold">
                            R{auction.current_bid || auction.starting_bid_price || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Registration Fee</span>
                          <span>R{auction.registration_fee}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    {status === "buy-now" ? (
                      <Button className="w-full" onClick={() => handleBuyNow(auction)}>
                        Buy Now
                      </Button>
                    ) : (
                      <Button className="w-full" onClick={() => openBidDialog(auction)}>
                        {status === "live" ? "Place Bid" : "View Details"}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Bid Dialog */}
        <Dialog open={bidDialogOpen} onOpenChange={setBidDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedAuction?.product?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Countdown Timer */}
              {selectedAuction?.status === "active" && selectedAuction?.end_date && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <AuctionCountdown 
                    targetDate={selectedAuction.end_date} 
                    type="end"
                  />
                </div>
              )}
              {selectedAuction?.start_date && isFuture(new Date(selectedAuction.start_date)) && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <AuctionCountdown 
                    targetDate={selectedAuction.start_date} 
                    type="start"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Starting Bid</p>
                  <p className="font-bold">R{selectedAuction?.starting_bid_price || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Bid</p>
                  <p className="font-bold text-lg">
                    R{selectedAuction?.current_bid || selectedAuction?.starting_bid_price || 0}
                  </p>
                </div>
              </div>

              {!user ? (
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p className="text-muted-foreground">Please login to participate in this auction</p>
                </div>
              ) : !userRegistration ? (
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <p className="text-sm">
                    <strong>Registration Fee:</strong> R{selectedAuction?.registration_fee}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Register to bid. If you win, this fee becomes your deposit. 
                    If you don't win, the fee is non-refundable.
                  </p>
                  <Button onClick={handleRegister} className="w-full">
                    <Users className="mr-2 h-4 w-4" /> Register to Bid
                  </Button>
                </div>
              ) : selectedAuction?.status === "active" ? (
                <div className="space-y-3">
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      ✓ You are registered for this auction
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Your Bid (R)</Label>
                    <Input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      min={(selectedAuction?.current_bid || selectedAuction?.starting_bid_price || 0) + 1}
                    />
                  </div>
                  <Button onClick={handlePlaceBid} className="w-full">
                    <Gavel className="mr-2 h-4 w-4" /> Place Bid
                  </Button>
                </div>
              ) : (
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p className="text-muted-foreground">Auction is not active yet</p>
                </div>
              )}

              {bids.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Recent Bids</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {bids.slice(0, 10).map((bid) => (
                      <div key={bid.id} className="flex justify-between text-sm">
                        <span>{bid.profiles?.name || "Anonymous"}</span>
                        <span className="font-medium">R{bid.bid_amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AuctionsPage;
