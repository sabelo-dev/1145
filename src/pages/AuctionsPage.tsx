import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { Gavel, Clock, Users, Trophy, Medal, Award } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Auction, AuctionBid, AuctionRegistration } from "@/types/auction";
import { isFuture } from "date-fns";
import SEO from "@/components/SEO";
import AuctionCountdown from "@/components/auction/AuctionCountdown";
import BidHistoryChart from "@/components/auction/BidHistoryChart";

const AuctionsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { playSound } = useNotificationSound();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [bidCounts, setBidCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [userRegistration, setUserRegistration] = useState<AuctionRegistration | null>(null);
  const [userRegistrations, setUserRegistrations] = useState<Record<string, boolean>>({});
  const [userWonAuctions, setUserWonAuctions] = useState<Record<string, boolean>>({});
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  
  // Track user's highest bids per auction to detect outbids
  const userHighestBidsRef = useRef<Record<string, number>>({});

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
          // Update the specific auction in state without full refetch for smoother UX
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedAuction = payload.new as any;
            setAuctions(prev => prev.map(a => 
              a.id === updatedAuction.id 
                ? { ...a, ...updatedAuction }
                : a
            ));
          } else {
            fetchAuctions();
          }
        }
      )
      .subscribe();

    // Subscribe to all auction bids for real-time updates on cards
    const allBidsChannel = supabase
      .channel('all-auction-bids')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auction_bids'
        },
        async (payload) => {
          console.log('Global bid update:', payload);
          const newBid = payload.new as any;
          
          // Update the auction's current bid in state
          setAuctions(prev => prev.map(a => 
            a.id === newBid.auction_id 
              ? { ...a, current_bid: newBid.bid_amount }
              : a
          ));
          
          // Update bid count
          setBidCounts(prev => ({
            ...prev,
            [newBid.auction_id]: (prev[newBid.auction_id] || 0) + 1
          }));
          
          // Check if user was outbid (someone else bid higher than user's highest bid)
          if (user && newBid.user_id !== user.id) {
            const userHighestBid = userHighestBidsRef.current[newBid.auction_id];
            if (userHighestBid && newBid.bid_amount > userHighestBid) {
              // User was outbid!
              playSound('outbid');
              toast({
                title: "You've been outbid!",
                description: `Someone placed a higher bid of R${newBid.bid_amount} on an auction you're participating in.`,
                variant: "destructive",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(auctionsChannel);
      supabase.removeChannel(allBidsChannel);
    };
  }, [user, playSound, toast]);

  // Fetch user's existing bids to track for outbid notifications
  useEffect(() => {
    const fetchUserBids = async () => {
      if (!user) return;
      
      const { data: userBids } = await supabase
        .from("auction_bids")
        .select("auction_id, bid_amount")
        .eq("user_id", user.id);
      
      if (userBids) {
        const highestBids: Record<string, number> = {};
        userBids.forEach(bid => {
          highestBids[bid.auction_id] = Math.max(
            highestBids[bid.auction_id] || 0,
            bid.bid_amount
          );
        });
        userHighestBidsRef.current = highestBids;
      }
    };
    
    fetchUserBids();
  }, [user]);

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
            // Update minimum bid amount based on bid increment
            const increment = auctionData.bid_increment || 50;
            const newMinBid = ((auctionData.current_bid || auctionData.starting_bid_price || 0) + increment);
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
      
      // Fetch bid counts for all auctions
      if (data && data.length > 0) {
        const auctionIds = data.map(a => a.id);
        const { data: bidCountsData } = await supabase
          .from("auction_bids")
          .select("auction_id")
          .in("auction_id", auctionIds);
        
        if (bidCountsData) {
          const counts: Record<string, number> = {};
          bidCountsData.forEach(bid => {
            counts[bid.auction_id] = (counts[bid.auction_id] || 0) + 1;
          });
          setBidCounts(counts);
        }
        
        // Fetch user registrations for all auctions
        if (user) {
          const { data: userRegs } = await supabase
            .from("auction_registrations")
            .select("auction_id")
            .eq("user_id", user.id)
            .eq("payment_status", "paid")
            .in("auction_id", auctionIds);
          
          if (userRegs) {
            const regs: Record<string, boolean> = {};
            userRegs.forEach(reg => {
              regs[reg.auction_id] = true;
            });
            setUserRegistrations(regs);
          }
          
          // Fetch user's won auctions that need checkout
          const { data: wonAuctions } = await supabase
            .from("auctions")
            .select("id")
            .eq("winner_id", user.id)
            .eq("status", "sold");
          
          if (wonAuctions) {
            const won: Record<string, boolean> = {};
            wonAuctions.forEach(a => {
              won[a.id] = true;
            });
            setUserWonAuctions(won);
          }
        }
      }
    } catch (error: any) {
      console.error("Error fetching auctions:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Process ended auctions automatically
  const processEndedAuction = async (auctionId: string) => {
    try {
      console.log(`Processing ended auction: ${auctionId}`);
      await supabase.functions.invoke("process-ended-auctions", {
        body: { auctionId },
      });
      // Refresh auctions after processing
      setTimeout(() => fetchAuctions(), 2000);
    } catch (error) {
      console.error("Failed to process ended auction:", error);
    }
  };

  const openBidDialog = async (auction: Auction) => {
    setSelectedAuction(auction);
    const increment = auction.bid_increment || 50;
    setBidAmount(((auction.current_bid || auction.starting_bid_price || 0) + increment).toString());
    
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

  const handleRegister = () => {
    if (!user) {
      toast({
        title: "Please login",
        description: "You need to be logged in to register for auctions",
        variant: "destructive",
      });
      navigate(`/login?redirect=/auction-registration?auctionId=${selectedAuction?.id}`);
      return;
    }

    if (!selectedAuction) return;

    // Redirect to auction registration checkout page
    navigate(`/auction-registration?auctionId=${selectedAuction.id}`);
  };

  const handlePlaceBid = async () => {
    if (!user || !selectedAuction || !userRegistration) return;

    const amount = parseFloat(bidAmount);
    const increment = selectedAuction.bid_increment || 50;
    const currentBid = selectedAuction.current_bid || selectedAuction.starting_bid_price || 0;
    const minBid = currentBid + increment;

    if (amount < minBid) {
      toast({
        title: "Invalid Bid",
        description: `Bid must be at least R${minBid} (minimum increment: R${increment})`,
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

      // Send outbid notification to previous highest bidder
      try {
        await supabase.functions.invoke("send-outbid-notification", {
          body: {
            auctionId: selectedAuction.id,
            newBidAmount: amount,
            newBidderId: user.id,
            productName: selectedAuction.product?.name || "Auction Item",
          },
        });
      } catch (notifyError) {
        console.error("Failed to send outbid notification:", notifyError);
        // Don't fail the bid if notification fails
      }

      // Anti-sniping: extend auction by 2 minutes if bid placed in final minute
      if (selectedAuction.end_date) {
        const endTime = new Date(selectedAuction.end_date).getTime();
        const now = Date.now();
        const timeRemaining = endTime - now;
        
        if (timeRemaining > 0 && timeRemaining <= 60000) {
          const newEndDate = new Date(endTime + 2 * 60000).toISOString();
          await supabase
            .from("auctions")
            .update({ end_date: newEndDate })
            .eq("id", selectedAuction.id);
          
          toast({
            title: "Auction Extended!",
            description: "Anti-sniping: Auction extended by 2 minutes",
          });
        }
      }

      // Track user's highest bid for this auction
      userHighestBidsRef.current[selectedAuction.id] = Math.max(
        userHighestBidsRef.current[selectedAuction.id] || 0,
        amount
      );

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
      const increment = selectedAuction.bid_increment || 50;
      setBidAmount((amount + increment).toString());
      
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
      <div className="container py-8">Loading auctions...</div>
    );
  }

  return (
    <>
      <SEO 
        title="Auctions | 1145 Lifestyle"
        description="Bid on exclusive products in our live auctions"
      />
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
                      className={`absolute top-2 right-2 ${status === "live" ? "animate-pulse" : ""}`}
                      variant={status === "live" ? "default" : status === "buy-now" ? "secondary" : "outline"}
                    >
                      {status === "live" && <span className="mr-1 h-2 w-2 rounded-full bg-white inline-block animate-ping" />}
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
                        onExpire={fetchAuctions}
                      />
                    )}
                    {status === "live" && auction.end_date && (
                      <AuctionCountdown 
                        targetDate={auction.end_date} 
                        type="end" 
                        compact 
                        className="text-destructive"
                        onExpire={() => processEndedAuction(auction.id)}
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
                          <span className="text-sm text-muted-foreground">Total Bids</span>
                          <span className="flex items-center gap-1">
                            <Gavel className="h-3 w-3" />
                            {bidCounts[auction.id] || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Registration Fee</span>
                          <span>R{auction.registration_fee}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    {status === "buy-now" ? (
                      <Button className="w-full" onClick={() => handleBuyNow(auction)}>
                        Buy Now
                      </Button>
                    ) : (
                      <>
                        {/* Show Register button if user is not registered for live/upcoming auctions */}
                        {(status === "live" || status === "upcoming") && !userRegistrations[auction.id] && (
                          <Button 
                            className="w-full" 
                            variant="default"
                            onClick={() => {
                              if (!user) {
                                toast({
                                  title: "Please login",
                                  description: "You need to be logged in to register for auctions",
                                  variant: "destructive",
                                });
                                navigate(`/login?redirect=/auction-registration?auctionId=${auction.id}`);
                                return;
                              }
                              navigate(`/auction-registration?auctionId=${auction.id}`);
                            }}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            Register to Bid (R{auction.registration_fee})
                          </Button>
                        )}
                        {/* Show Place Bid button for registered users or View Details for all */}
                        <Button 
                          className="w-full" 
                          variant={userRegistrations[auction.id] ? "default" : "outline"}
                          onClick={() => openBidDialog(auction)}
                        >
                          {status === "live" && userRegistrations[auction.id] 
                            ? "Place Bid" 
                            : status === "live" 
                              ? "View Auction"
                              : "View Details"}
                        </Button>
                      </>
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
              {/* Product Image Thumbnail */}
              {(() => {
                const imageUrl = selectedAuction?.product?.product_images?.[0]?.image_url;
                return (
                  <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={selectedAuction?.product?.name || "Auction item"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Gavel className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {selectedAuction?.product?.description || "No description available"}
                      </p>
                      {selectedAuction?.bid_increment && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Minimum increment: R{selectedAuction.bid_increment}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

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

              {/* Bid History Chart */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Bid History</h4>
                <BidHistoryChart 
                  bids={bids} 
                  startingBid={selectedAuction?.starting_bid_price || 0} 
                />
              </div>

              {bids.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    Bidder Leaderboard
                  </h4>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {(() => {
                        // Group bids by user and get their highest bid
                        const bidderMap = new Map<string, { name: string; amount: number; odId: string }>();
                        bids.forEach(bid => {
                          const existing = bidderMap.get(bid.user_id);
                          if (!existing || bid.bid_amount > existing.amount) {
                            bidderMap.set(bid.user_id, {
                              name: bid.profiles?.name || "Anonymous",
                              amount: bid.bid_amount,
                              odId: bid.user_id
                            });
                          }
                        });
                        
                        // Sort by highest bid
                        const leaderboard = Array.from(bidderMap.entries())
                          .sort((a, b) => b[1].amount - a[1].amount);
                        
                        return leaderboard.map(([odId, bidder], index) => {
                          const isCurrentUser = user?.id === odId;
                          const rank = index + 1;
                          
                          return (
                            <div 
                              key={odId} 
                              className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                                isCurrentUser 
                                  ? "bg-primary/10 border border-primary/20" 
                                  : rank <= 3 
                                    ? "bg-muted/50" 
                                    : ""
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center">
                                  {rank === 1 ? (
                                    <Trophy className="h-5 w-5 text-yellow-500" />
                                  ) : rank === 2 ? (
                                    <Medal className="h-5 w-5 text-gray-400" />
                                  ) : rank === 3 ? (
                                    <Award className="h-5 w-5 text-amber-600" />
                                  ) : (
                                    <span className="text-sm font-medium text-muted-foreground">
                                      #{rank}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <p className={`text-sm font-medium ${isCurrentUser ? "text-primary" : ""}`}>
                                    {bidder.name}
                                    {isCurrentUser && (
                                      <span className="ml-2 text-xs text-primary">(You)</span>
                                    )}
                                  </p>
                                  {rank === 1 && (
                                    <p className="text-xs text-green-600">Leading</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`font-bold ${rank === 1 ? "text-green-600" : ""}`}>
                                  R{bidder.amount}
                                </p>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {bids.length} total bid{bids.length !== 1 ? "s" : ""} from {
                      new Set(bids.map(b => b.user_id)).size
                    } bidder{new Set(bids.map(b => b.user_id)).size !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AuctionsPage;
