
import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface AdminProduct {
  id: string;
  name: string;
  price: number;
  status: "pending" | "approved" | "rejected";
  category: string;
  created_at: string;
  store_id: string;
  store_name?: string;
  merchant_business_name?: string;
  merchant_id?: string;
  merchant_email?: string;
}

const AdminProducts: React.FC = () => {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch products from database
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data: productsData, error } = await supabase
          .from('products')
          .select(`
            id,
            name,
            price,
            status,
            category,
            created_at,
            store_id
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Get all unique store IDs
        const storeIds = [...new Set(productsData?.map(p => p.store_id) || [])];
        
        // Fetch all stores with merchants in one query
        const { data: storesData } = await supabase
          .from('stores')
          .select(`
            id,
            name,
            merchant_id,
            merchants!inner(
              id,
              business_name,
              user_id
            )
          `)
          .in('id', storeIds);

        // Get all unique merchant user IDs
        const userIds = [...new Set(storesData?.map(s => s.merchants.user_id) || [])];
        
        // Fetch all profiles in one query
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds);

        // Create maps for quick lookup
        const profilesMap = new Map(
          (profilesData || []).map(p => [p.id, p])
        );

        const storesMap = new Map(
          (storesData || []).map(s => [s.id, {
            ...s,
            merchant_email: profilesMap.get(s.merchants.user_id)?.email
          }])
        );

        const formattedProducts = (productsData || []).map((product) => {
          const store = storesMap.get(product.store_id);
          return {
            id: product.id,
            name: product.name,
            price: product.price,
            status: product.status as "pending" | "approved" | "rejected",
            category: product.category,
            created_at: product.created_at,
            store_id: product.store_id,
            store_name: store?.name || 'N/A',
            merchant_business_name: store?.merchants?.business_name || 'N/A',
            merchant_id: store?.merchants?.id || '',
            merchant_email: store?.merchant_email || 'N/A'
          };
        });

        setProducts(formattedProducts);
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

    fetchProducts();
  }, [toast]);

  const handleUpdateProductStatus = async (
    productId: string,
    newStatus: "approved" | "rejected"
  ) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ status: newStatus })
        .eq('id', productId);

      if (error) throw error;

      setProducts(
        products.map((product) =>
          product.id === productId
            ? { ...product, status: newStatus }
            : product
        )
      );

      toast({
        title: "Product status updated",
        description: `Product has been ${newStatus}.`,
      });
    } catch (error) {
      console.error('Error updating product status:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update product status.",
      });
    }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Product Management</h2>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading products...</div>
      ) : (
        <Table>
          <TableCaption>List of all products</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Merchant Info</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{product.merchant_business_name || 'N/A'}</div>
                  </div>
                </TableCell>
                <TableCell>{product.store_name || 'N/A'}</TableCell>
                <TableCell>R{(product.price || 0).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      product.status === "approved"
                        ? "default"
                        : product.status === "rejected"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {product.status}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(product.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {product.status === "pending" && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() =>
                            handleUpdateProductStatus(product.id, "approved")
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            handleUpdateProductStatus(product.id, "rejected")
                          }
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {product.status !== "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleUpdateProductStatus(
                            product.id,
                            product.status === "approved" ? "rejected" : "approved"
                          )
                        }
                      >
                        {product.status === "approved" ? "Unpublish" : "Publish"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default AdminProducts;
