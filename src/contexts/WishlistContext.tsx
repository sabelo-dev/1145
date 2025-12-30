import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface WishlistContextType {
  wishlistItems: string[];
  addToWishlist: (productId: string) => void;
  removeFromWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch wishlist from database when user logs in
  const fetchWishlist = useCallback(async () => {
    if (!user) {
      // Fall back to localStorage for non-authenticated users
      const stored = localStorage.getItem("wishlist");
      setWishlistItems(stored ? JSON.parse(stored) : []);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("wishlists")
        .select("product_id")
        .eq("user_id", user.id);

      if (error) throw error;

      const productIds = data?.map((item) => item.product_id) || [];
      setWishlistItems(productIds);
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      // Fall back to localStorage on error
      const stored = localStorage.getItem("wishlist");
      setWishlistItems(stored ? JSON.parse(stored) : []);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // Sync to localStorage for non-authenticated users
  useEffect(() => {
    if (!user) {
      localStorage.setItem("wishlist", JSON.stringify(wishlistItems));
    }
  }, [wishlistItems, user]);

  const addToWishlist = async (productId: string) => {
    if (wishlistItems.includes(productId)) return;

    // Optimistic update
    setWishlistItems((prev) => [...prev, productId]);

    if (user) {
      try {
        const { error } = await supabase
          .from("wishlists")
          .insert({ user_id: user.id, product_id: productId });

        if (error) throw error;

        toast({
          title: "Added to Wishlist",
          description: "Product has been added to your wishlist.",
        });
      } catch (error: any) {
        // Revert optimistic update
        setWishlistItems((prev) => prev.filter((id) => id !== productId));
        console.error("Error adding to wishlist:", error);
        toast({
          title: "Error",
          description: "Failed to add product to wishlist.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Added to Wishlist",
        description: "Product has been added to your wishlist.",
      });
    }
  };

  const removeFromWishlist = async (productId: string) => {
    // Optimistic update
    setWishlistItems((prev) => prev.filter((id) => id !== productId));

    if (user) {
      try {
        const { error } = await supabase
          .from("wishlists")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);

        if (error) throw error;

        toast({
          title: "Removed from Wishlist",
          description: "Product has been removed from your wishlist.",
        });
      } catch (error: any) {
        // Revert optimistic update
        setWishlistItems((prev) => [...prev, productId]);
        console.error("Error removing from wishlist:", error);
        toast({
          title: "Error",
          description: "Failed to remove product from wishlist.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Removed from Wishlist",
        description: "Product has been removed from your wishlist.",
      });
    }
  };

  const isInWishlist = (productId: string) => {
    return wishlistItems.includes(productId);
  };

  const toggleWishlist = (productId: string) => {
    if (isInWishlist(productId)) {
      removeFromWishlist(productId);
    } else {
      addToWishlist(productId);
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
        toggleWishlist,
        isLoading,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};
