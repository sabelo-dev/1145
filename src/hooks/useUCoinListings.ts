import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface UCoinListing {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  images: string[];
  category: string | null;
  condition: string;
  price_ucoin: number;
  allow_bids: boolean;
  starting_bid_ucoin: number | null;
  highest_bid_ucoin: number | null;
  highest_bidder_id: string | null;
  location: string | null;
  status: string;
  buyer_id: string | null;
  sold_price_ucoin: number | null;
  created_at: string;
}

export interface UCoinBid {
  id: string;
  listing_id: string;
  bidder_id: string;
  amount_ucoin: number;
  status: string;
  created_at: string;
}

export interface NewListingInput {
  title: string;
  description?: string;
  category?: string;
  condition: string;
  price_ucoin: number;
  allow_bids: boolean;
  starting_bid_ucoin?: number | null;
  location?: string;
  images: string[];
}

const normalise = (row: any): UCoinListing => ({
  ...row,
  images: Array.isArray(row.images) ? row.images.filter((i: unknown) => typeof i === "string") : [],
});

export function useUCoinListings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [listings, setListings] = useState<UCoinListing[]>([]);
  const [myListings, setMyListings] = useState<UCoinListing[]>([]);
  const [myPurchases, setMyPurchases] = useState<UCoinListing[]>([]);
  const [bidsByListing, setBidsByListing] = useState<Record<string, UCoinBid[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const active = await supabase
      .from("ucoin_listings")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(200);
    setListings(((active.data as any[]) || []).map(normalise));

    if (user) {
      const [mine, bought, bids] = await Promise.all([
        supabase.from("ucoin_listings").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
        supabase.from("ucoin_listings").select("*").eq("buyer_id", user.id).order("sold_at", { ascending: false }),
        supabase.from("ucoin_listing_bids").select("*").order("amount_ucoin", { ascending: false }),
      ]);
      setMyListings(((mine.data as any[]) || []).map(normalise));
      setMyPurchases(((bought.data as any[]) || []).map(normalise));
      const grouped: Record<string, UCoinBid[]> = {};
      ((bids.data as any[]) || []).forEach((b) => {
        grouped[b.listing_id] = [...(grouped[b.listing_id] || []), b as UCoinBid];
      });
      setBidsByListing(grouped);
    } else {
      setMyListings([]);
      setMyPurchases([]);
      setBidsByListing({});
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadImages = useCallback(
    async (files: File[]): Promise<string[]> => {
      if (!user || files.length === 0) return [];
      const urls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `ucoin-listings/${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
        if (error) {
          console.error("Listing photo upload failed:", error);
          continue;
        }
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      return urls;
    },
    [user],
  );

  const createListing = useCallback(
    async (input: NewListingInput) => {
      if (!user) return false;
      setBusy(true);
      const { error } = await supabase.from("ucoin_listings").insert({
        seller_id: user.id,
        title: input.title,
        description: input.description || null,
        category: input.category || null,
        condition: input.condition,
        price_ucoin: input.price_ucoin,
        allow_bids: input.allow_bids,
        starting_bid_ucoin: input.allow_bids ? input.starting_bid_ucoin ?? null : null,
        location: input.location || null,
        images: input.images,
      });
      setBusy(false);
      if (error) {
        toast({ variant: "destructive", title: "Could not list item", description: error.message });
        return false;
      }
      toast({ title: "Item listed", description: "Your item is now live in the UCoin market." });
      await load();
      return true;
    },
    [user, toast, load],
  );

  const cancelListing = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("ucoin_listings").update({ status: "cancelled" }).eq("id", id);
      if (error) {
        toast({ variant: "destructive", title: "Could not remove item", description: error.message });
        return;
      }
      toast({ title: "Item removed" });
      await load();
    },
    [toast, load],
  );

  const runRpc = useCallback(
    async (fn: "buy_ucoin_listing" | "place_ucoin_bid" | "accept_ucoin_bid", args: any, successTitle: string) => {
      setBusy(true);
      const { data, error } = await supabase.rpc(fn as any, args);
      setBusy(false);
      const result = data as any;
      if (error || !result?.success) {
        toast({
          variant: "destructive",
          title: "That did not go through",
          description: result?.error || error?.message || "Please try again.",
        });
        return false;
      }
      toast({ title: successTitle });
      await load();
      return true;
    },
    [toast, load],
  );

  const buyListing = useCallback(
    (listingId: string) => runRpc("buy_ucoin_listing", { p_listing_id: listingId }, "Bought with UCoin"),
    [runRpc],
  );

  const placeBid = useCallback(
    (listingId: string, amount: number) =>
      runRpc("place_ucoin_bid", { p_listing_id: listingId, p_amount: amount }, "Offer placed"),
    [runRpc],
  );

  const acceptBid = useCallback(
    (bidId: string) => runRpc("accept_ucoin_bid", { p_bid_id: bidId }, "Offer accepted — UCoin received"),
    [runRpc],
  );

  return {
    listings,
    myListings,
    myPurchases,
    bidsByListing,
    loading,
    busy,
    reload: load,
    uploadImages,
    createListing,
    cancelListing,
    buyListing,
    placeBid,
    acceptBid,
  };
}
