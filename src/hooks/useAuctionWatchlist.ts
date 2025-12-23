import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface WatchlistItem {
  id: string;
  auction_id: string;
  user_id: string;
  created_at: string;
  notify_on_bid: boolean;
  notify_on_ending: boolean;
}

export const useAuctionWatchlist = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Fetch user's watchlist
  const fetchWatchlist = useCallback(async () => {
    if (!user) {
      setWatchlist([]);
      setWatchlistIds(new Set());
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("auction_watchlist")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;

      setWatchlist(data || []);
      setWatchlistIds(new Set(data?.map(item => item.auction_id) || []));
    } catch (error) {
      console.error("Error fetching watchlist:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  // Check if auction is in watchlist
  const isWatching = useCallback((auctionId: string) => {
    return watchlistIds.has(auctionId);
  }, [watchlistIds]);

  // Add auction to watchlist
  const addToWatchlist = useCallback(async (auctionId: string, options?: { notifyOnBid?: boolean; notifyOnEnding?: boolean }) => {
    if (!user) {
      toast({
        title: "Please login",
        description: "You need to be logged in to add auctions to your watchlist",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { data, error } = await supabase
        .from("auction_watchlist")
        .insert({
          user_id: user.id,
          auction_id: auctionId,
          notify_on_bid: options?.notifyOnBid ?? true,
          notify_on_ending: options?.notifyOnEnding ?? true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Already watching",
            description: "This auction is already in your watchlist",
          });
          return false;
        }
        throw error;
      }

      setWatchlist(prev => [...prev, data]);
      setWatchlistIds(prev => new Set([...prev, auctionId]));

      toast({
        title: "Added to Watchlist",
        description: "You'll receive notifications for this auction",
      });

      return true;
    } catch (error: any) {
      console.error("Error adding to watchlist:", error);
      toast({
        title: "Error",
        description: "Failed to add to watchlist",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast]);

  // Remove auction from watchlist
  const removeFromWatchlist = useCallback(async (auctionId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("auction_watchlist")
        .delete()
        .eq("user_id", user.id)
        .eq("auction_id", auctionId);

      if (error) throw error;

      setWatchlist(prev => prev.filter(item => item.auction_id !== auctionId));
      setWatchlistIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(auctionId);
        return newSet;
      });

      toast({
        title: "Removed from Watchlist",
        description: "You won't receive notifications for this auction anymore",
      });

      return true;
    } catch (error: any) {
      console.error("Error removing from watchlist:", error);
      toast({
        title: "Error",
        description: "Failed to remove from watchlist",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast]);

  // Toggle watchlist status
  const toggleWatchlist = useCallback(async (auctionId: string) => {
    if (isWatching(auctionId)) {
      return removeFromWatchlist(auctionId);
    } else {
      return addToWatchlist(auctionId);
    }
  }, [isWatching, addToWatchlist, removeFromWatchlist]);

  // Update notification preferences
  const updateNotificationPreferences = useCallback(async (
    auctionId: string, 
    preferences: { notifyOnBid?: boolean; notifyOnEnding?: boolean }
  ) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("auction_watchlist")
        .update({
          notify_on_bid: preferences.notifyOnBid,
          notify_on_ending: preferences.notifyOnEnding,
        })
        .eq("user_id", user.id)
        .eq("auction_id", auctionId);

      if (error) throw error;

      setWatchlist(prev => prev.map(item => 
        item.auction_id === auctionId 
          ? { ...item, ...preferences }
          : item
      ));

      toast({
        title: "Preferences Updated",
        description: "Notification preferences have been saved",
      });

      return true;
    } catch (error: any) {
      console.error("Error updating preferences:", error);
      return false;
    }
  }, [user, toast]);

  return {
    watchlist,
    watchlistIds,
    loading,
    isWatching,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    updateNotificationPreferences,
    refreshWatchlist: fetchWatchlist,
  };
};
