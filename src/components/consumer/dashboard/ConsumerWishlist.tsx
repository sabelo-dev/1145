import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface WishlistProduct {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  slug: string;
  quantity: number;
  rating: number | null;
  created_at: string;
  images: { image_url: string }[];
  store: { name: string } | null;
}

const ConsumerWishlist: React.FC = () => {
  const { wishlistItems, removeFromWishlist, isLoading: wishlistLoading } = useWishlist();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      if (wishlistItems.length === 0) {
        setProducts([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("products")
          .select(`
            id,
            name,
            price,
            compare_at_price,
            slug,
            quantity,
            rating,
            created_at,
            images:product_images(image_url),
            store:stores(name)
          `)
          .in("id", wishlistItems);

        if (error) throw error;

        // Transform data to match our interface
        const transformedProducts = data?.map((product: any) => ({
          ...product,
          store: product.store?.[0] || null,
        })) || [];

        setProducts(transformedProducts);
      } catch (error) {
        console.error("Error fetching wishlist products:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [wishlistItems]);

  const handleRemoveFromWishlist = (productId: string) => {
    removeFromWishlist(productId);
  };

  const handleAddToCart = (product: WishlistProduct) => {
    if (product.quantity <= 0) return;
    
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0]?.image_url || "/placeholder.svg",
    });
  };

  const handleViewProduct = (slug: string) => {
    navigate(`/product/${slug}`);
  };

  const loading = isLoading || wishlistLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5" />
          <span className="text-lg font-medium">My Wishlist</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {products.length} saved items
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="w-full h-48" />
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Heart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Your wishlist is empty</h3>
            <p className="text-muted-foreground text-center mb-4">
              Save products you love for later by clicking the heart icon
            </p>
            <Button onClick={() => navigate("/shop")}>Continue Shopping</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            const inStock = product.quantity > 0;
            const imageUrl = product.images?.[0]?.image_url || "/placeholder.svg";
            
            return (
              <Card key={product.id} className="overflow-hidden group">
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt={product.name}
                    className="w-full h-48 object-cover cursor-pointer transition-transform group-hover:scale-105"
                    onClick={() => handleViewProduct(product.slug)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                    onClick={() => handleRemoveFromWishlist(product.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {!inStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Badge variant="secondary">Out of Stock</Badge>
                    </div>
                  )}
                </div>
                
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <h3 
                      className="font-medium line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleViewProduct(product.slug)}
                    >
                      {product.name}
                    </h3>
                    {product.store && (
                      <p className="text-sm text-muted-foreground">{product.store.name}</p>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">
                        R{product.price.toFixed(2)}
                      </span>
                      {product.compare_at_price && product.compare_at_price > product.price && (
                        <span className="text-sm text-muted-foreground line-through">
                          R{product.compare_at_price.toFixed(2)}
                        </span>
                      )}
                    </div>
                    
                    {product.rating && (
                      <div className="flex items-center gap-1">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={`text-xs ${
                                i < Math.floor(product.rating!)
                                  ? "text-yellow-400"
                                  : "text-gray-300"
                              }`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ({product.rating.toFixed(1)})
                        </span>
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      Added {format(new Date(product.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      className="flex-1"
                      disabled={!inStock}
                      onClick={() => handleAddToCart(product)}
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      {inStock ? "Add to Cart" : "Out of Stock"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConsumerWishlist;
