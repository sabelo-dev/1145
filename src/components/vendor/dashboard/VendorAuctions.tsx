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
import { Plus, Gavel } from "lucide-react";
import { Auction } from "@/types/auction";
import { format } from "date-fns";

interface Product {
  id: string;
  name: string;
  price: number;
  status: string;
}

const VendorAuctions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
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

      // Fetch all products for this store (include pending, approved, active)
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, status")
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
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} (R{product.price}) - {product.status}
                        </SelectItem>
                      ))}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorAuctions;
