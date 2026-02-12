
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { InventorySettingsDialog } from "./dialogs/InventorySettingsDialog";
import { 
  Package, 
  Search, 
  AlertTriangle, 
  Plus,
  Minus,
  RotateCcw,
  Download,
  Upload
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const VendorInventory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
  }, [user?.id]);

  const fetchProducts = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Get vendor data first
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (vendorError) throw vendorError;

      // Get stores for this vendor
      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id')
        .eq('vendor_id', vendor.id);

      if (storesError) throw storesError;

      if (stores.length === 0) {
        setProducts([]);
        return;
      }

      const storeIds = stores.map(store => store.id);
      setStoreId(stores[0].id); // Save first store ID for dialogs

      // Get products from all vendor stores
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('store_id', storeIds)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch products",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStock = async (productId: string, newQuantity: number) => {
    if (newQuantity < 0) return;

    try {
      setUpdating(productId);
      
      const { error } = await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', productId);

      if (error) throw error;

      setProducts(products.map(p => 
        p.id === productId ? { ...p, quantity: newQuantity } : p
      ));

      toast({
        title: "Stock updated",
        description: "Product inventory has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating stock:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update stock",
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleExportCSV = () => {
    if (products.length === 0) {
      toast({
        variant: "destructive",
        title: "No data",
        description: "No products to export.",
      });
      return;
    }

    // Create CSV header
    const headers = ['Product Name', 'SKU', 'Current Stock', 'Status', 'Last Updated'];
    
    // Create CSV rows
    const rows = products.map(product => [
      product.name,
      product.sku || 'N/A',
      product.quantity,
      product.quantity === 0 ? 'Out of Stock' : product.quantity <= 10 ? 'Low Stock' : 'In Stock',
      new Date(product.updated_at).toLocaleDateString()
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: "Inventory data has been exported to CSV.",
    });
  };

  const handleBulkImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload a CSV file.",
      });
      return;
    }

    try {
      setLoading(true);
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          variant: "destructive",
          title: "Empty file",
          description: "CSV file is empty or has no data rows.",
        });
        return;
      }

      // Skip header row
      const dataLines = lines.slice(1);
      let successCount = 0;
      let errorCount = 0;

      for (const line of dataLines) {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const [, sku, quantity] = values;

        if (!sku || !quantity) continue;

        // Find product by SKU
        const product = products.find(p => p.sku === sku);
        if (!product) {
          errorCount++;
          continue;
        }

        const newQuantity = parseInt(quantity);
        if (isNaN(newQuantity) || newQuantity < 0) {
          errorCount++;
          continue;
        }

        // Update stock
        const { error } = await supabase
          .from('products')
          .update({ quantity: newQuantity })
          .eq('id', product.id);

        if (error) {
          errorCount++;
        } else {
          successCount++;
        }
      }

      // Refresh products
      await fetchProducts();

      toast({
        title: "Import completed",
        description: `Successfully updated ${successCount} products. ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
      });
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast({
        variant: "destructive",
        title: "Import failed",
        description: "Failed to process CSV file.",
      });
    } finally {
      setLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredProducts = products.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (stock: number, lowStockThreshold = 10) => {
    if (stock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (stock <= lowStockThreshold) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">Low Stock</Badge>;
    } else {
      return <Badge variant="default">In Stock</Badge>;
    }
  };

  const lowStockCount = products.filter(item => item.quantity <= 10 && item.quantity > 0).length;
  const outOfStockCount = products.filter(item => item.quantity === 0).length;

  if (loading) {
    return <div>Loading inventory...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory Management</h2>
          <p className="text-muted-foreground">
            Monitor and manage your product inventory levels.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button variant="outline" onClick={handleBulkImport}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Inventory Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">
              Products in inventory
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground">
              Products need restocking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{outOfStockCount}</div>
            <p className="text-xs text-muted-foreground">
              Products unavailable
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Inventory</CardTitle>
          <CardDescription>
            Current stock levels and alerts for all products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.sku || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${
                        item.quantity === 0 ? 'text-red-600' :
                        item.quantity <= 10 ? 'text-orange-600' :
                        'text-green-600'
                      }`}>
                        {item.quantity}
                      </span>
                      <span className="text-muted-foreground">units</span>
                    </div>
                  </TableCell>
                  <TableCell>10</TableCell>
                  <TableCell>
                    {getStatusBadge(item.quantity, 10)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={updating === item.id}
                        onClick={() => updateStock(item.id, Math.max(0, item.quantity - 1))}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input 
                        type="number" 
                        value={item.quantity}
                        className="w-16 h-8 text-center"
                        min="0"
                        disabled={updating === item.id}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value) || 0;
                          updateStock(item.id, newValue);
                        }}
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={updating === item.id}
                        onClick={() => updateStock(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Actions</CardTitle>
          <CardDescription>
            Perform actions on multiple products at once
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">Auto-Restock Settings</h4>
              <p className="text-sm text-muted-foreground">
                Automatically reorder when stock falls below threshold
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSettingsDialogOpen(true)}
              >
                Configure Auto-Restock
              </Button>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Stock Alerts</h4>
              <p className="text-sm text-muted-foreground">
                Get notified when products are running low
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setNotificationDialogOpen(true)}
              >
                Notification Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {storeId && (
        <>
          <InventorySettingsDialog
            open={settingsDialogOpen}
            onOpenChange={setSettingsDialogOpen}
            storeId={storeId}
          />
          <InventorySettingsDialog
            open={notificationDialogOpen}
            onOpenChange={setNotificationDialogOpen}
            storeId={storeId}
          />
        </>
      )}
    </div>
  );
};

export default VendorInventory;
