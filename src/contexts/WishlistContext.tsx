import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
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

  const fetchWishlist = useCallback(async () => {
    if (!user) {
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
      setWishlistItems(data?.map((item) => item.product_id) || []);
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      const stored = localStorage.getItem("wishlist");
      setWishlistItems(stored ? JSON.parse(stored) : []);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem("wishlist", JSON.stringify(wishlistItems));
    }
  }, [wishlistItems, user]);

  const addToWishlist = useCallback(async (productId: string) => {
    if (wishlistItems.includes(productId)) return;

    setWishlistItems((prev) => [...prev, productId]);

    if (user) {
      try {
        const { error } = await supabase
          .from("wishlists")
          .insert({ user_id: user.id, product_id: productId });
        if (error) throw error;
        toast({ title: "Added to Wishlist", description: "Product has been added to your wishlist." });
      } catch (error) {
        setWishlistItems((prev) => prev.filter((id) => id !== productId));
        toast({ title: "Error", description: "Failed to add product to wishlist.", variant: "destructive" });
      }
    } else {
      toast({ title: "Added to Wishlist", description: "Product has been added to your wishlist." });
    }
  }, [user, wishlistItems, toast]);

  const removeFromWishlist = useCallback(async (productId: string) => {
    setWishlistItems((prev) => prev.filter((id) => id !== productId));

    if (user) {
      try {
        const { error } = await supabase
          .from("wishlists")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        if (error) throw error;
        toast({ title: "Removed from Wishlist", description: "Product has been removed from your wishlist." });
      } catch (error) {
        setWishlistItems((prev) => [...prev, productId]);
        toast({ title: "Error", description: "Failed to remove product from wishlist.", variant: "destructive" });
      }
    } else {
      toast({ title: "Removed from Wishlist", description: "Product has been removed from your wishlist." });
    }
  }, [user, toast]);

  const isInWishlist = useCallback((productId: string) => {
    return wishlistItems.includes(productId);
  }, [wishlistItems]);

  const toggleWishlist = useCallback((productId: string) => {
    if (wishlistItems.includes(productId)) {
      removeFromWishlist(productId);
    } else {
      addToWishlist(productId);
    }
  }, [wishlistItems, removeFromWishlist, addToWishlist]);

  const value = useMemo(() => ({
    wishlistItems,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    toggleWishlist,
    isLoading,
  }), [wishlistItems, addToWishlist, removeFromWishlist, isInWishlist, toggleWishlist, isLoading]);

  return (
    <WishlistContext.Provider value={value}>
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
