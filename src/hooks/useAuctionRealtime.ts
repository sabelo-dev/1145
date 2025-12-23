import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNotificationSound } from "@/hooks/useNotificationSound";

interface AuctionNotification {
  id: string;
  type: 'new_bid' | 'outbid' | 'auction_won' | 'auction_ending' | 'auction_started';
  auctionId: string;
  productName: string;
  message: string;
  bidAmount?: number;
  timestamp: Date;
  read: boolean;
}

interface UseAuctionRealtimeOptions {
  enableSound?: boolean;
  enableToast?: boolean;
  auctionIds?: string[]; // Subscribe to specific auctions only
}

export const useAuctionRealtime = (options: UseAuctionRealtimeOptions = {}) => {
  const { enableSound = true, enableToast = true, auctionIds } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  const { playSound } = useNotificationSound();
  
  const [notifications, setNotifications] = useState<AuctionNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveAuctions, setLiveAuctions] = useState<Record<string, { currentBid: number; bidCount: number }>>({});
  
  // Track user's highest bids per auction
  const userHighestBidsRef = useRef<Record<string, number>>({});
  // Track user's registered auctions
  const userRegisteredAuctionsRef = useRef<Set<string>>(new Set());

  // Add a new notification
  const addNotification = useCallback((notification: Omit<AuctionNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: AuctionNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Keep last 50
    setUnreadCount(prev => prev + 1);
    
    return newNotification;
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Fetch user's existing bids and registrations
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      // Fetch user's bids
      const { data: userBids } = await supabase
        .from("auction_bids")
        .select("auction_id, bid_amount")
        .eq("user_id", user.id);
      
      if (userBids) {
        const highestBids: Record<string, number> = {};
        userBids.forEach(bid => {
          highestBids[bid.auction_id] = Math.max(
            highestBids[bid.auction_id] || 0,
            bid.bid_amount
          );
        });
        userHighestBidsRef.current = highestBids;
      }
      
      // Fetch user's registrations
      const { data: registrations } = await supabase
        .from("auction_registrations")
        .select("auction_id")
        .eq("user_id", user.id)
        .eq("payment_status", "paid");
      
      if (registrations) {
        userRegisteredAuctionsRef.current = new Set(registrations.map(r => r.auction_id));
      }
    };
    
    fetchUserData();
  }, [user]);

  // Subscribe to real-time auction updates
  useEffect(() => {
    // Subscribe to auction status changes
    const auctionsChannel = supabase
      .channel('realtime-auctions')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions'
        },
        async (payload) => {
          const updatedAuction = payload.new as any;
          const oldAuction = payload.old as any;
          
          // Check if user is registered for this auction
          const isRegistered = userRegisteredAuctionsRef.current.has(updatedAuction.id);
          
          // Auction started
          if (oldAuction.status !== 'active' && updatedAuction.status === 'active' && isRegistered) {
            const { data: product } = await supabase
              .from("products")
              .select("name")
              .eq("id", updatedAuction.product_id)
              .single();
            
            const notification = addNotification({
              type: 'auction_started',
              auctionId: updatedAuction.id,
              productName: product?.name || 'Unknown Product',
              message: `Auction for "${product?.name}" has started! Start bidding now.`,
            });
            
            if (enableSound) playSound('newBid');
            if (enableToast) {
              toast({
                title: "Auction Started!",
                description: notification.message,
              });
            }
          }
          
          // User won the auction
          if (updatedAuction.winner_id === user?.id && oldAuction.winner_id !== user?.id) {
            const { data: product } = await supabase
              .from("products")
              .select("name")
              .eq("id", updatedAuction.product_id)
              .single();
            
            const notification = addNotification({
              type: 'auction_won',
              auctionId: updatedAuction.id,
              productName: product?.name || 'Unknown Product',
              message: `Congratulations! You won the auction for "${product?.name}" with a bid of R${updatedAuction.winning_bid}!`,
              bidAmount: updatedAuction.winning_bid,
            });
            
            if (enableSound) playSound('win');
            if (enableToast) {
              toast({
                title: "🎉 You Won!",
                description: notification.message,
              });
            }
          }
        }
      )
      .subscribe();

    // Subscribe to new bids
    const bidsChannel = supabase
      .channel('realtime-bids')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auction_bids'
        },
        async (payload) => {
          const newBid = payload.new as any;
          
          // Skip if specific auctionIds provided and this isn't one of them
          if (auctionIds && !auctionIds.includes(newBid.auction_id)) return;
          
          // Update live auction data
          setLiveAuctions(prev => ({
            ...prev,
            [newBid.auction_id]: {
              currentBid: newBid.bid_amount,
              bidCount: (prev[newBid.auction_id]?.bidCount || 0) + 1,
            },
          }));
          
          // Get auction and product details
          const { data: auction } = await supabase
            .from("auctions")
            .select("product_id")
            .eq("id", newBid.auction_id)
            .single();
          
          const { data: product } = await supabase
            .from("products")
            .select("name")
            .eq("id", auction?.product_id)
            .single();
          
          const productName = product?.name || 'Unknown Product';
          
          // Check if user was outbid
          if (user && newBid.user_id !== user.id) {
            const userHighestBid = userHighestBidsRef.current[newBid.auction_id];
            
            if (userHighestBid && newBid.bid_amount > userHighestBid) {
              // User was outbid
              const notification = addNotification({
                type: 'outbid',
                auctionId: newBid.auction_id,
                productName,
                message: `You've been outbid on "${productName}"! New bid: R${newBid.bid_amount}`,
                bidAmount: newBid.bid_amount,
              });
              
              if (enableSound) playSound('outbid');
              if (enableToast) {
                toast({
                  title: "You've Been Outbid!",
                  description: notification.message,
                  variant: "destructive",
                });
              }
            } else if (userRegisteredAuctionsRef.current.has(newBid.auction_id)) {
              // User is registered but not the highest bidder - just notify of new bid
              addNotification({
                type: 'new_bid',
                auctionId: newBid.auction_id,
                productName,
                message: `New bid of R${newBid.bid_amount} on "${productName}"`,
                bidAmount: newBid.bid_amount,
              });
            }
          }
        }
      )
      .subscribe();

    // Subscribe to new registrations (to track user's new registrations)
    const registrationsChannel = supabase
      .channel('realtime-registrations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_registrations',
          filter: user ? `user_id=eq.${user.id}` : undefined
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const reg = payload.new as any;
            if (reg.payment_status === 'paid') {
              userRegisteredAuctionsRef.current.add(reg.auction_id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(auctionsChannel);
      supabase.removeChannel(bidsChannel);
      supabase.removeChannel(registrationsChannel);
    };
  }, [user, auctionIds, enableSound, enableToast, playSound, toast, addNotification]);

  // Update user's highest bid when they place a bid
  const updateUserBid = useCallback((auctionId: string, bidAmount: number) => {
    userHighestBidsRef.current[auctionId] = Math.max(
      userHighestBidsRef.current[auctionId] || 0,
      bidAmount
    );
  }, []);

  return {
    notifications,
    unreadCount,
    liveAuctions,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    updateUserBid,
  };
};
