
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { applyPlatformMarkup } from "@/utils/pricingMarkup";
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Upload,
  Download
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ProductFormModal from "./ProductFormModal";
import ProductViewModal from "./ProductViewModal";

const VendorProducts = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch vendor products from database
  const fetchProducts = async () => {
    if (!user?.id) return;

    try {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images(id, image_url, position),
          stores!inner(
            id,
            name,
            slug,
            description,
            logo_url,
            banner_url,
            vendors!inner(
              id,
              business_name,
              user_id
            )
          )
        `)
        .eq('stores.vendors.user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load products.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [user?.id]);

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setFormMode("add");
    setShowFormModal(true);
  };

  const handleEditProduct = (product: any) => {
    setSelectedProduct(product);
    setFormMode("edit");
    setShowFormModal(true);
  };

  const handleViewProduct = (product: any) => {
    setSelectedProduct(product);
    setShowViewModal(true);
  };

  const handleDeleteProduct = (product: any) => {
    setProductToDelete(product);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;

    try {
      // Delete product images from storage first
      const { data: images } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('product_id', productToDelete.id);

      if (images) {
        for (const image of images) {
          const path = image.image_url.split('/').pop();
          if (path) {
            await supabase.storage
              .from('product-images')
              .remove([`${productToDelete.id}/${path}`]);
          }
        }
      }

      // Delete product images records
      await supabase
        .from('product_images')
        .delete()
        .eq('product_id', productToDelete.id);

      // Delete product variations
      await supabase
        .from('product_variations')
        .delete()
        .eq('product_id', productToDelete.id);

      // Delete the product
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete.id);

      if (error) throw error;

      setProducts(products.filter(p => p.id !== productToDelete.id));
      toast({
        title: "Product Deleted",
        description: "Product has been successfully deleted.",
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete product.",
      });
    } finally {
      setShowDeleteDialog(false);
      setProductToDelete(null);
    }
  };

  const handleFormSuccess = () => {
    fetchProducts();
  };

  const handleBulkExport = () => {
    const csvData = [
      ['Name', 'SKU', 'Category', 'Subcategory', 'Price', 'Compare At Price', 'Quantity', 'Description', 'Status'],
      ...products.map(product => [
        product.name,
        product.sku || '',
        product.category,
        product.subcategory || '',
        product.price,
        product.compare_at_price || '',
        product.quantity,
        product.description?.replace(/,/g, ';') || '',
        product.status
      ])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `products-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Successful",
      description: `${products.length} products exported to CSV.`
    });
  };

  const handleBulkImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.split(','));
      const headers = rows[0];
      const data = rows.slice(1);

      // Get vendor's store
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('id, business_name, custom_markup_percentage')
        .eq('user_id', user.id)
        .single();

      if (vendorError || !vendor) {
        throw new Error("Vendor profile not found");
      }

      let { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('vendor_id', vendor.id)
        .single();

      // Auto-create store if it doesn't exist
      if (!store) {
        const storeName = vendor.business_name || 'My Store';
        const baseSlug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const uniqueSlug = `${baseSlug}-${Date.now()}`;

        const { data: newStore, error: storeError } = await supabase
          .from('stores')
          .insert({
            vendor_id: vendor.id,
            name: storeName,
            slug: uniqueSlug,
            description: `Welcome to ${storeName}`,
          })
          .select('id')
          .single();

        if (storeError) {
          throw new Error("Failed to create store");
        }
        store = newStore;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of data) {
        if (row.length < 5 || !row[0]) continue; // Skip empty rows

        try {
          const productData = {
            store_id: store.id,
            name: row[0].trim(),
            sku: row[1]?.trim() || null,
            category: row[2]?.trim() || 'Uncategorized',
            subcategory: row[3]?.trim() || null,
            price: applyPlatformMarkup(parseFloat(row[4]) || 0),
            compare_at_price: row[5] ? applyPlatformMarkup(parseFloat(row[5])) : null,
            quantity: parseInt(row[6]) || 0,
            description: row[7]?.replace(/;/g, ',') || '',
            status: 'pending',
            slug: row[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
          };

          const { error } = await supabase
            .from('products')
            .insert(productData);

          if (error) throw error;
          successCount++;
        } catch (err) {
          console.error('Error importing row:', err);
          errorCount++;
        }
      }

      toast({
        title: "Import Complete",
        description: `Successfully imported ${successCount} products. ${errorCount} failed.`
      });

      fetchProducts();
    } catch (error) {
      console.error('Error importing products:', error);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: "Failed to import products. Please check your CSV format."
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">
            Manage your product inventory and listings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBulkExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={() => document.getElementById('bulk-import-input')?.click()} disabled={importing}>
            <Upload className="h-4 w-4 mr-2" />
            {importing ? 'Importing...' : 'Import'}
          </Button>
          <input
            id="bulk-import-input"
            type="file"
            accept=".csv"
            onChange={handleBulkImport}
            className="hidden"
          />
          <Button onClick={handleAddProduct}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Products List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Products ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No products found. Add your first product to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <img 
                      src={
                        product.product_images?.[0]?.image_url || 
                        "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=60"
                      } 
                      alt={product.name}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                    <div className="space-y-1">
                      <h3 className="font-medium">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        SKU: {product.sku || 'N/A'}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{product.category}</Badge>
                        <Badge 
                          variant={
                            product.status === "approved" || product.status === "active" ? "default" :
                            product.quantity === 0 ? "destructive" :
                            "outline"
                          }
                        >
                          {product.quantity === 0 ? "Out of Stock" : 
                           product.status === "approved" ? "Active" : product.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">R{product.price}</p>
                      <p className="text-sm text-muted-foreground">
                        Stock: {product.quantity || 0}
                      </p>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleViewProduct(product)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDeleteProduct(product)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ProductFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSuccess={handleFormSuccess}
        product={selectedProduct}
        mode={formMode}
      />

      <ProductViewModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        onEdit={() => {
          setShowViewModal(false);
          handleEditProduct(selectedProduct);
        }}
        product={selectedProduct}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone and will remove all associated images.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VendorProducts;
