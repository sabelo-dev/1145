import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Gavel, Pencil, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Auction } from "@/types/auction";
import { format } from "date-fns";

interface Product {
  id: string;
  name: string;
  price: number;
  status: string;
  product_images: { image_url: string }[];
}

const VendorAuctions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [baseAmount, setBaseAmount] = useState("");

  useEffect(() => {
    if (user) {
      fetchAuctions();
      fetchProducts();
    }
  }, [user]);

  const fetchAuctions = async () => {
    try {
      const { data, error } = await supabase
        .from("auctions")
        .select(`
          *,
          product:products(id, name, description, price, store_id, product_images(image_url))
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

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      // Get vendor's store products that are not already in auction
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendors")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (vendorError || !vendorData) {
        console.error("Error fetching vendor:", vendorError);
        setProductsLoading(false);
        return;
      }

      const { data: storeData, error: storeError } = await supabase
        .from("stores")
        .select("id")
        .eq("vendor_id", vendorData.id)
        .single();

      if (storeError || !storeData) {
        console.error("Error fetching store:", storeError);
        setProductsLoading(false);
        return;
      }

      // Fetch all products for this store (include pending, approved, active) with images
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, status, product_images(image_url)")
        .eq("store_id", storeData.id)
        .in("status", ["pending", "approved", "active"]);

      if (productsError) throw productsError;

      // Get existing auction product IDs to filter them out
      const { data: existingAuctions } = await supabase
        .from("auctions")
        .select("product_id")
        .not("status", "in", '("sold","unsold")');

      const auctionProductIds = new Set(existingAuctions?.map(a => a.product_id) || []);
      
      // Filter out products that are already in an active auction
      const availableProducts = (productsData || []).filter(
        product => !auctionProductIds.has(product.id)
      );

      setProducts(availableProducts);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setProductsLoading(false);
    }
  };

  const handleCreateAuction = async () => {
    if (!selectedProduct || !baseAmount) {
      toast({
        title: "Error",
        description: "Please select a product and enter a base amount",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("auctions").insert({
        product_id: selectedProduct,
        vendor_base_amount: parseFloat(baseAmount),
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Auction Created",
        description: "Your auction has been submitted for admin approval",
      });
      setDialogOpen(false);
      setSelectedProduct("");
      setBaseAmount("");
      fetchAuctions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditAuction = (auction: Auction) => {
    setSelectedAuction(auction);
    setBaseAmount(auction.vendor_base_amount.toString());
    setEditDialogOpen(true);
  };

  const handleUpdateAuction = async () => {
    if (!selectedAuction || !baseAmount) {
      toast({
        title: "Error",
        description: "Please enter a base amount",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("auctions")
        .update({ vendor_base_amount: parseFloat(baseAmount) })
        .eq("id", selectedAuction.id);

      if (error) throw error;

      toast({
        title: "Auction Updated",
        description: "Your auction has been updated successfully",
      });
      setEditDialogOpen(false);
      setSelectedAuction(null);
      setBaseAmount("");
      fetchAuctions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancelAuction = (auction: Auction) => {
    setSelectedAuction(auction);
    setCancelDialogOpen(true);
  };

  const confirmCancelAuction = async () => {
    if (!selectedAuction) return;

    try {
      const { error } = await supabase
        .from("auctions")
        .delete()
        .eq("id", selectedAuction.id);

      if (error) throw error;

      toast({
        title: "Auction Cancelled",
        description: "Your auction has been cancelled and removed",
      });
      setCancelDialogOpen(false);
      setSelectedAuction(null);
      fetchAuctions();
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const canEditOrCancel = (status: string) => {
    return ["pending", "approved"].includes(status);
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Auctions</h2>
          <p className="text-muted-foreground">Manage your auction products</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Auction Product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Auction</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Product</Label>
                {productsLoading ? (
                  <div className="text-sm text-muted-foreground py-2">Loading products...</div>
                ) : products.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">
                    No available products. Add products to your store first or all products are already in auctions.
                  </div>
                ) : (
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => {
                        const imageUrl = product.product_images?.[0]?.image_url;
                        return (
                          <SelectItem key={product.id} value={product.id}>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                {imageUrl ? (
                                  <img 
                                    src={imageUrl} 
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                                    No img
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium">{product.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  R{product.price} • {product.status}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Base Amount (Minimum you require)</Label>
                <Input
                  type="number"
                  placeholder="Enter base amount"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  This is the minimum amount you're willing to accept for the product
                </p>
              </div>
              <Button onClick={handleCreateAuction} className="w-full">
                Submit for Approval
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" /> Your Auctions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auctions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No auctions yet. Create your first auction product!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Base Amount</TableHead>
                  <TableHead>Starting Bid</TableHead>
                  <TableHead>Current Bid</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auctions.map((auction) => (
                  <TableRow key={auction.id}>
                    <TableCell className="font-medium">
                      {auction.product?.name || "Unknown Product"}
                    </TableCell>
                    <TableCell>R{auction.vendor_base_amount}</TableCell>
                    <TableCell>
                      {auction.starting_bid_price ? `R${auction.starting_bid_price}` : "Not set"}
                    </TableCell>
                    <TableCell>
                      {auction.current_bid ? `R${auction.current_bid}` : "No bids"}
                    </TableCell>
                    <TableCell>
                      {auction.start_date
                        ? format(new Date(auction.start_date), "PPp")
                        : "Not scheduled"}
                    </TableCell>
                    <TableCell>{getStatusBadge(auction.status)}</TableCell>
                    <TableCell className="text-right">
                      {canEditOrCancel(auction.status) ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditAuction(auction)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelAuction(auction)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Auction Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Auction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <div className="text-sm text-muted-foreground py-2 px-3 bg-muted rounded-md">
                {selectedAuction?.product?.name || "Unknown Product"}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Base Amount (Minimum you require)</Label>
              <Input
                type="number"
                placeholder="Enter base amount"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                This is the minimum amount you're willing to accept for the product
              </p>
            </div>
            <Button onClick={handleUpdateAuction} className="w-full">
              Update Auction
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Auction Alert Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Auction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this auction for "{selectedAuction?.product?.name}"? 
              This action cannot be undone and the auction will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Auction</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancelAuction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancel Auction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VendorAuctions;
