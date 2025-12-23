import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Gavel, Settings, Users, History } from "lucide-react";
import { Auction, AuctionRegistration } from "@/types/auction";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StatusHistoryItem {
  id: string;
  old_status: string | null;
  new_status: string;
  notes: string | null;
  created_at: string;
  changed_by: string | null;
}

const AdminAuctions = () => {
  const { toast } = useToast();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [registrations, setRegistrations] = useState<AuctionRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [registrationsDialogOpen, setRegistrationsDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Config form state
  const [startingBid, setStartingBid] = useState("");
  const [registrationFee, setRegistrationFee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = async () => {
    try {
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          *,
          product:products(id, name, description, price, store_id, 
            product_images(image_url),
            stores(name, vendor_id, vendors(business_name, user_id))
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAuctions((data as unknown as Auction[]) || []);
    } catch (error: any) {
      console.error("Error fetching auctions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async (auctionId: string) => {
    try {
      const { data, error } = await supabase
        .from("auction_registrations")
        .select(`
          *,
          profiles(name, email)
        `)
        .eq("auction_id", auctionId);

      if (error) throw error;
      setRegistrations((data as unknown as AuctionRegistration[]) || []);
    } catch (error: any) {
      console.error("Error fetching registrations:", error);
    }
  };

  const openConfigDialog = (auction: Auction) => {
    setSelectedAuction(auction);
    setStartingBid(auction.starting_bid_price?.toString() || "");
    setRegistrationFee(auction.registration_fee?.toString() || "0");
    if (auction.start_date) {
      const start = new Date(auction.start_date);
      setStartDate(format(start, "yyyy-MM-dd"));
      setStartTime(format(start, "HH:mm"));
    }
    if (auction.end_date) {
      const end = new Date(auction.end_date);
      setEndDate(format(end, "yyyy-MM-dd"));
      setEndTime(format(end, "HH:mm"));
    }
    setConfigDialogOpen(true);
  };

  const openRegistrationsDialog = async (auction: Auction) => {
    setSelectedAuction(auction);
    await fetchRegistrations(auction.id);
    setRegistrationsDialogOpen(true);
  };

  const fetchStatusHistory = async (auctionId: string) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("auction_status_history")
        .select("*")
        .eq("auction_id", auctionId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStatusHistory(data || []);
    } catch (error: any) {
      console.error("Error fetching status history:", error);
      toast({
        title: "Error",
        description: "Failed to fetch status history",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleViewHistory = async (auction: Auction) => {
    setSelectedAuction(auction);
    await fetchStatusHistory(auction.id);
    setHistoryDialogOpen(true);
  };

  const sendAuctionStatusEmail = async (auction: Auction, newStatus: string) => {
    try {
      // Get the vendor's email
      const vendorUserId = auction.product?.stores?.vendors?.user_id;
      if (!vendorUserId) {
        console.log("No vendor user ID found for auction email");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("email, name")
        .eq("id", vendorUserId)
        .single();

      if (!profile?.email) {
        console.log("No email found for vendor");
        return;
      }

      await supabase.functions.invoke("send-auction-status-email", {
        body: {
          userEmail: profile.email,
          userName: profile.name || auction.product?.stores?.vendors?.business_name,
          productName: auction.product?.name || "Unknown Product",
          auctionId: auction.id,
          newStatus,
          currentBid: auction.current_bid,
          winningBid: auction.winning_bid,
          startDate: auction.start_date,
          endDate: auction.end_date,
        },
      });

      console.log("Auction status email sent successfully");
    } catch (error) {
      console.error("Error sending auction status email:", error);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedAuction) return;

    try {
      const startDateTime = startDate && startTime 
        ? new Date(`${startDate}T${startTime}`).toISOString() 
        : null;
      const endDateTime = endDate && endTime 
        ? new Date(`${endDate}T${endTime}`).toISOString() 
        : null;

      const { error } = await supabase
        .from("auctions")
        .update({
          starting_bid_price: parseFloat(startingBid) || null,
          registration_fee: parseFloat(registrationFee) || 0,
          start_date: startDateTime,
          end_date: endDateTime,
          status: "approved",
        })
        .eq("id", selectedAuction.id);

      if (error) throw error;

      // Send email notification for approval
      const updatedAuction = {
        ...selectedAuction,
        start_date: startDateTime,
        end_date: endDateTime,
      };
      sendAuctionStatusEmail(updatedAuction, "approved");

      toast({
        title: "Auction Updated",
        description: "Auction configuration has been saved",
      });
      setConfigDialogOpen(false);
      fetchAuctions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (auctionId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("auctions")
        .update({ status: newStatus })
        .eq("id", auctionId);

      if (error) throw error;

      // Find the auction and send email notification
      const auction = auctions.find(a => a.id === auctionId);
      if (auction) {
        sendAuctionStatusEmail(auction, newStatus);
      }

      toast({
        title: "Status Updated",
        description: `Auction status changed to ${newStatus}`,
      });
      fetchAuctions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const sendWinnerNotificationEmail = async (auction: Auction, winnerId: string, winningBidAmount: number) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, name")
        .eq("id", winnerId)
        .single();

      if (!profile?.email) {
        console.log("No email found for winner");
        return;
      }

      await supabase.functions.invoke("send-auction-status-email", {
        body: {
          userEmail: profile.email,
          userName: profile.name || "Winner",
          productName: auction.product?.name || "Unknown Product",
          auctionId: auction.id,
          newStatus: "sold",
          winningBid: winningBidAmount,
          isWinnerNotification: true,
        },
      });

      console.log("Winner notification email sent successfully");
    } catch (error) {
      console.error("Error sending winner notification email:", error);
    }
  };

  const handleEndAuction = async (auction: Auction) => {
    try {
      // Get highest bid
      const { data: bids } = await supabase
        .from("auction_bids")
        .select("*")
        .eq("auction_id", auction.id)
        .order("bid_amount", { ascending: false })
        .limit(1);

      if (bids && bids.length > 0) {
        const winningBid = bids[0];
        
        // Update auction with winner
        await supabase
          .from("auctions")
          .update({
            status: "sold",
            winner_id: winningBid.user_id,
            winning_bid: winningBid.bid_amount,
          })
          .eq("id", auction.id);

        // Mark registration as winner
        await supabase
          .from("auction_registrations")
          .update({ is_winner: true, deposit_applied: true })
          .eq("auction_id", auction.id)
          .eq("user_id", winningBid.user_id);

        // Send email notification for sold auction (to vendor)
        const updatedAuction = { ...auction, winning_bid: winningBid.bid_amount };
        sendAuctionStatusEmail(updatedAuction, "sold");

        // Send email notification to the winner
        sendWinnerNotificationEmail(auction, winningBid.user_id, winningBid.bid_amount);

        toast({
          title: "Auction Ended",
          description: "Winner has been determined and notified via email",
        });
      } else {
        // No bids - mark as unsold
        await supabase
          .from("auctions")
          .update({ status: "unsold" })
          .eq("id", auction.id);

        // Send email notification for unsold auction
        sendAuctionStatusEmail(auction, "unsold");

        toast({
          title: "Auction Ended",
          description: "No bids received. Product can be sold at base amount.",
        });
      }
      
      fetchAuctions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "outline",
      active: "default",
      ended: "secondary",
      sold: "default",
      unsold: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status.toUpperCase()}</Badge>;
  };

  if (loading) {
    return <div className="p-6">Loading auctions...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Auction Management</h2>
        <p className="text-muted-foreground">Configure and manage all auctions</p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Auctions</TabsTrigger>
          <TabsTrigger value="pending">Pending Approval</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="ended">Ended</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <AuctionTable 
            auctions={auctions} 
            onConfigure={openConfigDialog}
            onViewRegistrations={openRegistrationsDialog}
            onViewHistory={handleViewHistory}
            onStatusChange={handleStatusChange}
            onEndAuction={handleEndAuction}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
        <TabsContent value="pending">
          <AuctionTable 
            auctions={auctions.filter(a => a.status === "pending")} 
            onConfigure={openConfigDialog}
            onViewRegistrations={openRegistrationsDialog}
            onViewHistory={handleViewHistory}
            onStatusChange={handleStatusChange}
            onEndAuction={handleEndAuction}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
        <TabsContent value="active">
          <AuctionTable 
            auctions={auctions.filter(a => a.status === "active")} 
            onConfigure={openConfigDialog}
            onViewRegistrations={openRegistrationsDialog}
            onViewHistory={handleViewHistory}
            onStatusChange={handleStatusChange}
            onEndAuction={handleEndAuction}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
        <TabsContent value="ended">
          <AuctionTable 
            auctions={auctions.filter(a => ["ended", "sold", "unsold"].includes(a.status))} 
            onConfigure={openConfigDialog}
            onViewRegistrations={openRegistrationsDialog}
            onViewHistory={handleViewHistory}
            onStatusChange={handleStatusChange}
            onEndAuction={handleEndAuction}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Auction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <p className="text-sm font-medium">{selectedAuction?.product?.name}</p>
              <p className="text-sm text-muted-foreground">
                Vendor Base Amount: R{selectedAuction?.vendor_base_amount}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Starting Bid Price</Label>
              <Input
                type="number"
                placeholder="Enter starting bid"
                value={startingBid}
                onChange={(e) => setStartingBid(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Registration Fee</Label>
              <Input
                type="number"
                placeholder="Enter registration fee"
                value={registrationFee}
                onChange={(e) => setRegistrationFee(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Fee consumers pay to participate (used as deposit for winner)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleSaveConfig} className="w-full">
              Save & Approve
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Registrations Dialog */}
      <Dialog open={registrationsDialogOpen} onOpenChange={setRegistrationsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Auction Registrations</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {registrations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No registrations yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Fee Paid</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Winner</TableHead>
                    <TableHead>Deposit Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{reg.profiles?.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">{reg.profiles?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>R{reg.registration_fee_paid}</TableCell>
                      <TableCell>
                        <Badge variant={reg.payment_status === "paid" ? "default" : "secondary"}>
                          {reg.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{reg.is_winner ? "Yes" : "No"}</TableCell>
                      <TableCell>{reg.deposit_applied ? "Yes" : "No"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Status History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Status History
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              {selectedAuction?.product?.name}
            </p>
            {historyLoading ? (
              <p className="text-center py-4 text-muted-foreground">Loading history...</p>
            ) : statusHistory.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">No status history available</p>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                  {statusHistory.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="relative pl-6 pb-4 border-l-2 border-muted last:border-l-0"
                    >
                      <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.old_status ? (
                            <>
                              <Badge variant="outline" className="text-xs">
                                {item.old_status.toUpperCase()}
                              </Badge>
                              <span className="text-muted-foreground">→</span>
                              <Badge variant="default" className="text-xs">
                                {item.new_status.toUpperCase()}
                              </Badge>
                            </>
                          ) : (
                            <Badge variant="default" className="text-xs">
                              {item.new_status.toUpperCase()} (Created)
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        {item.notes && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface AuctionTableProps {
  auctions: Auction[];
  onConfigure: (auction: Auction) => void;
  onViewRegistrations: (auction: Auction) => void;
  onViewHistory: (auction: Auction) => void;
  onStatusChange: (id: string, status: string) => void;
  onEndAuction: (auction: Auction) => void;
  getStatusBadge: (status: string) => JSX.Element;
}

const AuctionTable = ({ 
  auctions, 
  onConfigure, 
  onViewRegistrations,
  onViewHistory,
  onStatusChange, 
  onEndAuction,
  getStatusBadge 
}: AuctionTableProps) => (
  <Card className="mt-4">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Gavel className="h-5 w-5" /> Auctions
      </CardTitle>
    </CardHeader>
    <CardContent>
      {auctions.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No auctions found</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Base Amount</TableHead>
              <TableHead>Starting Bid</TableHead>
              <TableHead>Current Bid</TableHead>
              <TableHead>Reg. Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auctions.map((auction) => {
              const imageUrl = auction.product?.product_images?.[0]?.image_url;
              return (
                <TableRow key={auction.id}>
                  <TableCell>
                    <div className="h-12 w-12 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={auction.product?.name || "Product"} 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Gavel className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {auction.product?.name || "Unknown"}
                  </TableCell>
                <TableCell>
                  {auction.product?.stores?.vendors?.business_name || "Unknown"}
                </TableCell>
                <TableCell>R{auction.vendor_base_amount}</TableCell>
                <TableCell>
                  {auction.starting_bid_price ? `R${auction.starting_bid_price}` : "-"}
                </TableCell>
                <TableCell>
                  {auction.current_bid ? `R${auction.current_bid}` : "-"}
                </TableCell>
                <TableCell>R{auction.registration_fee || 0}</TableCell>
                <TableCell>{getStatusBadge(auction.status)}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onConfigure(auction)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewRegistrations(auction)}
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewHistory(auction)}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    {auction.status === "approved" && (
                      <Button
                        size="sm"
                        onClick={() => onStatusChange(auction.id, "active")}
                      >
                        Start
                      </Button>
                    )}
                    {auction.status === "active" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onEndAuction(auction)}
                      >
                        End
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);

export default AdminAuctions;
