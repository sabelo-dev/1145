import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface LiveBidIndicatorProps {
  auctionId: string;
  initialBid: number | null;
  className?: string;
}

const LiveBidIndicator: React.FC<LiveBidIndicatorProps> = ({
  auctionId,
  initialBid,
  className,
}) => {
  const [currentBid, setCurrentBid] = useState(initialBid);
  const [isUpdating, setIsUpdating] = useState(false);
  const [bidCount, setBidCount] = useState(0);

  useEffect(() => {
    // Subscribe to bids for this specific auction
    const channel = supabase
      .channel(`live-bid-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auction_bids',
          filter: `auction_id=eq.${auctionId}`
        },
        (payload) => {
          const newBid = payload.new as any;
          setCurrentBid(newBid.bid_amount);
          setBidCount(prev => prev + 1);
          
          // Show update animation
          setIsUpdating(true);
          setTimeout(() => setIsUpdating(false), 1000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auctionId]);

  // Update if initialBid changes
  useEffect(() => {
    setCurrentBid(initialBid);
  }, [initialBid]);

  if (currentBid === null) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge
        variant="secondary"
        className={cn(
          "transition-all duration-300",
          isUpdating && "animate-pulse bg-green-500 text-white scale-105"
        )}
      >
        <TrendingUp className={cn(
          "h-3 w-3 mr-1",
          isUpdating && "animate-bounce"
        )} />
        R{currentBid.toLocaleString()}
      </Badge>
      {bidCount > 0 && (
        <span className="text-xs text-muted-foreground">
          +{bidCount} new
        </span>
      )}
    </div>
  );
};

export default LiveBidIndicator;
