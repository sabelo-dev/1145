import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Coins, MapPin, Gavel } from "lucide-react";
import type { UCoinListing } from "@/hooks/useUCoinListings";
import { UCOIN_RAND_VALUE } from "@/types/ucoin";

interface UCoinListingCardProps {
  listing: UCoinListing;
  balance: number;
  isOwner: boolean;
  signedIn: boolean;
  busy: boolean;
  onBuy: (id: string) => void;
  onBid: (id: string, amount: number) => void;
  onCancel?: (id: string) => void;
}

const PLACEHOLDER = "/placeholder.svg";

const conditionLabel: Record<string, string> = {
  new: "Brand new",
  like_new: "Like new",
  used: "Used",
};

const UCoinListingCard: React.FC<UCoinListingCardProps> = ({
  listing,
  balance,
  isOwner,
  signedIn,
  busy,
  onBuy,
  onBid,
  onCancel,
}) => {
  const [offer, setOffer] = useState("");
  const affordable = balance >= listing.price_ucoin;
  const minOffer = Math.max((listing.highest_bid_ucoin || 0) + 1, listing.starting_bid_ucoin || 1);

  return (
    <Card className="overflow-hidden flex flex-col">
      <img
        src={listing.images[0] || PLACEHOLDER}
        alt={listing.title}
        loading="lazy"
        className="h-40 w-full object-cover bg-muted"
      />
      <CardContent className="p-3 flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium line-clamp-2 min-w-0">{listing.title}</p>
          <Badge variant="secondary" className="shrink-0 text-[11px]">
            {conditionLabel[listing.condition] || listing.condition}
          </Badge>
        </div>

        {listing.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{listing.description}</p>
        )}

        {listing.location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{listing.location}</span>
          </p>
        )}

        <div className="mt-auto space-y-2">
          <div>
            <div className="flex items-center gap-1 text-gold font-semibold text-sm">
              <Coins className="h-3.5 w-3.5 shrink-0" />
              {listing.price_ucoin.toLocaleString()} UCoin
            </div>
            <p className="text-xs text-muted-foreground">
              about R{(listing.price_ucoin * UCOIN_RAND_VALUE).toFixed(2)}
            </p>
          </div>

          {listing.allow_bids && listing.highest_bid_ucoin ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Gavel className="h-3 w-3 shrink-0" />
              Best offer {listing.highest_bid_ucoin.toLocaleString()} UCoin
            </p>
          ) : null}

          {isOwner ? (
            <div className="flex flex-col gap-2">
              <Badge variant="outline" className="w-fit text-[11px]">Your item</Badge>
              {onCancel && listing.status === "active" && (
                <Button variant="outline" size="sm" onClick={() => onCancel(listing.id)} disabled={busy}>
                  Remove listing
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                size="sm"
                className="w-full"
                disabled={busy || !signedIn || !affordable}
                onClick={() => onBuy(listing.id)}
              >
                {!signedIn
                  ? "Sign in to buy"
                  : affordable
                    ? "Buy with UCoin"
                    : `${(listing.price_ucoin - balance).toLocaleString()} UCoin short`}
              </Button>

              {listing.allow_bids && signedIn && (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={minOffer}
                    value={offer}
                    placeholder={`${minOffer.toLocaleString()}+`}
                    onChange={(e) => setOffer(e.target.value)}
                    className="h-9"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      const amount = Math.floor(Number(offer) || 0);
                      if (amount > 0) {
                        onBid(listing.id, amount);
                        setOffer("");
                      }
                    }}
                  >
                    Offer
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UCoinListingCard;
