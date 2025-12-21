import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Gavel, Settings, Users } from "lucide-react";
import { Auction, AuctionRegistration } from "@/types/auction";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminAuctions = () => {
  const { toast } = useToast();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [registrations, setRegistrations] = useState<AuctionRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [registrationsDialogOpen, setRegistrationsDialogOpen] = useState(false);
  
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

        toast({
          title: "Auction Ended",
          description: "Winner has been determined and deposit applied",
        });
      } else {
        // No bids - mark as unsold
        await supabase
          .from("auctions")
          .update({ status: "unsold" })
          .eq("id", auction.id);

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
    </div>
  );
};

interface AuctionTableProps {
  auctions: Auction[];
  onConfigure: (auction: Auction) => void;
  onViewRegistrations: (auction: Auction) => void;
  onStatusChange: (id: string, status: string) => void;
  onEndAuction: (auction: Auction) => void;
  getStatusBadge: (status: string) => JSX.Element;
}

const AuctionTable = ({ 
  auctions, 
  onConfigure, 
  onViewRegistrations,
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
            {auctions.map((auction) => (
              <TableRow key={auction.id}>
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
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);

export default AdminAuctions;
