import React from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { useAuctionWatchlist } from "@/hooks/useAuctionWatchlist";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface WatchlistButtonProps {
  auctionId: string;
  variant?: "icon" | "default";
  size?: "sm" | "default" | "lg";
  className?: string;
}

const WatchlistButton: React.FC<WatchlistButtonProps> = ({
  auctionId,
  variant = "icon",
  size = "default",
  className,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isWatching, toggleWatchlist, loading } = useAuctionWatchlist();
  
  const watching = isWatching(auctionId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      navigate(`/login?redirect=/auctions`);
      return;
    }
    
    await toggleWatchlist(auctionId);
  };

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "rounded-full transition-all",
          watching && "text-red-500 hover:text-red-600",
          className
        )}
        title={watching ? "Remove from watchlist" : "Add to watchlist"}
      >
        <Heart
          className={cn(
            "h-5 w-5 transition-all",
            watching && "fill-current"
          )}
        />
      </Button>
    );
  }

  return (
    <Button
      variant={watching ? "secondary" : "outline"}
      size={size}
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "transition-all",
        watching && "text-red-500 border-red-200 bg-red-50 hover:bg-red-100",
        className
      )}
    >
      <Heart
        className={cn(
          "h-4 w-4 mr-2 transition-all",
          watching && "fill-current"
        )}
      />
      {watching ? "Watching" : "Watch"}
    </Button>
  );
};

export default WatchlistButton;
