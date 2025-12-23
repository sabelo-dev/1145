import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuctionWatchlist } from "@/hooks/useAuctionWatchlist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Heart, 
  Gavel, 
  Clock, 
  Trash2, 
  Bell, 
  BellOff,
  ExternalLink 
} from "lucide-react";
import { formatDistanceToNow, isFuture } from "date-fns";
import { Auction } from "@/types/auction";
import AuctionCountdown from "./AuctionCountdown";

interface WatchedAuction extends Auction {
  watchlist_id: string;
  notify_on_bid: boolean;
  notify_on_ending: boolean;
}

const AuctionWatchlist: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { watchlist, removeFromWatchlist, updateNotificationPreferences, loading: watchlistLoading } = useAuctionWatchlist();
  const [watchedAuctions, setWatchedAuctions] = useState<WatchedAuction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWatchedAuctions = async () => {
      if (!user || watchlist.length === 0) {
        setWatchedAuctions([]);
        setLoading(false);
        return;
      }

      try {
        const auctionIds = watchlist.map(w => w.auction_id);
        
        const { data, error } = await supabase
          .from("auctions")
          .select(`
            *,
            product:products(id, name, description, price, store_id, product_images(image_url))
          `)
          .in("id", auctionIds);

        if (error) throw error;

        // Merge watchlist preferences with auction data
        const merged = data?.map(auction => {
          const watchlistItem = watchlist.find(w => w.auction_id === auction.id);
          return {
            ...auction,
            watchlist_id: watchlistItem?.id || '',
            notify_on_bid: watchlistItem?.notify_on_bid ?? true,
            notify_on_ending: watchlistItem?.notify_on_ending ?? true,
          };
        }) as WatchedAuction[];

        setWatchedAuctions(merged || []);
      } catch (error) {
        console.error("Error fetching watched auctions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchedAuctions();
  }, [user, watchlist]);

  const handleRemove = async (auctionId: string) => {
    await removeFromWatchlist(auctionId);
  };

  const handleToggleNotification = async (
    auctionId: string, 
    type: 'bid' | 'ending',
    currentValue: boolean
  ) => {
    const preferences = type === 'bid' 
      ? { notifyOnBid: !currentValue }
      : { notifyOnEnding: !currentValue };
    
    await updateNotificationPreferences(auctionId, preferences);
    
    setWatchedAuctions(prev => prev.map(auction => 
      auction.id === auctionId 
        ? { 
            ...auction, 
            [type === 'bid' ? 'notify_on_bid' : 'notify_on_ending']: !currentValue 
          }
        : auction
    ));
  };

  const getAuctionStatus = (auction: WatchedAuction) => {
    if (auction.status === "sold") return { label: "Sold", variant: "default" as const };
    if (auction.status === "active") return { label: "Live", variant: "destructive" as const };
    if (auction.start_date && isFuture(new Date(auction.start_date))) {
      return { label: "Upcoming", variant: "secondary" as const };
    }
    return { label: auction.status, variant: "outline" as const };
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Login Required</h3>
          <p className="text-muted-foreground mb-4">
            Please login to view your auction watchlist
          </p>
          <Button onClick={() => navigate('/login')}>Login</Button>
        </CardContent>
      </Card>
    );
  }

  if (loading || watchlistLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            My Watchlist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4 p-4 border rounded-lg">
              <Skeleton className="w-20 h-20 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (watchedAuctions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            My Watchlist
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Watched Auctions</h3>
          <p className="text-muted-foreground mb-4">
            Start watching auctions to get notified about bids and when they're ending
          </p>
          <Button onClick={() => navigate('/auctions')}>
            <Gavel className="h-4 w-4 mr-2" />
            Browse Auctions
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            My Watchlist
          </span>
          <Badge variant="secondary">{watchedAuctions.length} auctions</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {watchedAuctions.map((auction) => {
              const status = getAuctionStatus(auction);
              const imageUrl = auction.product?.product_images?.[0]?.image_url;
              
              return (
                <div 
                  key={auction.id} 
                  className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Image */}
                  <div className="w-20 h-20 rounded overflow-hidden bg-muted flex-shrink-0">
                    {imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt={auction.product?.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gavel className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium truncate">
                          {auction.product?.name || 'Unknown Product'}
                        </h4>
                        <Badge variant={status.variant} className="mt-1">
                          {status.label}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          R{(auction.current_bid || auction.starting_bid_price || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Current bid</p>
                      </div>
                    </div>

                    {/* Countdown for active/upcoming */}
                    {(auction.status === 'active' || auction.status === 'approved') && auction.end_date && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <AuctionCountdown 
                          targetDate={auction.end_date} 
                          type="end"
                          compact
                        />
                      </div>
                    )}

                    {/* Notification toggles */}
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`bid-notify-${auction.id}`}
                          checked={auction.notify_on_bid}
                          onCheckedChange={() => handleToggleNotification(auction.id, 'bid', auction.notify_on_bid)}
                          className="scale-75"
                        />
                        <Label 
                          htmlFor={`bid-notify-${auction.id}`}
                          className="text-xs text-muted-foreground cursor-pointer"
                        >
                          Bid alerts
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`ending-notify-${auction.id}`}
                          checked={auction.notify_on_ending}
                          onCheckedChange={() => handleToggleNotification(auction.id, 'ending', auction.notify_on_ending)}
                          className="scale-75"
                        />
                        <Label 
                          htmlFor={`ending-notify-${auction.id}`}
                          className="text-xs text-muted-foreground cursor-pointer"
                        >
                          Ending alert
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => navigate('/auctions')}
                      title="View auction"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleRemove(auction.id)}
                      className="text-destructive hover:text-destructive"
                      title="Remove from watchlist"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AuctionWatchlist;
