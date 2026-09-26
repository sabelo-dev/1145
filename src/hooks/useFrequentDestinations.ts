import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FrequentDestination {
  address: string;
  lat: number | null;
  lng: number | null;
  count: number;
  lastUsed: string;
}

/**
 * Aggregates a passenger's past drop-off locations so repeat trips can be
 * started with a single tap. Most used first, then most recent.
 */
export function useFrequentDestinations(limit = 6) {
  const { user } = useAuth();
  const [destinations, setDestinations] = useState<FrequentDestination[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setDestinations([]);
      return;
    }
    setLoading(true);

    const { data } = await supabase
      .from("rides")
      .select("dropoff_address, dropoff_lat, dropoff_lng, dropoff_latitude, dropoff_longitude, created_at")
      .eq("passenger_id", user.id)
      .not("dropoff_address", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    const grouped = new Map<string, FrequentDestination>();
    (data ?? []).forEach((row: any) => {
      const address = String(row.dropoff_address ?? "").trim();
      if (!address) return;
      const key = address.toLowerCase();
      const existing = grouped.get(key);
      const lat = row.dropoff_lat ?? row.dropoff_latitude ?? null;
      const lng = row.dropoff_lng ?? row.dropoff_longitude ?? null;

      if (existing) {
        existing.count += 1;
        if (existing.lat == null && lat != null) {
          existing.lat = lat;
          existing.lng = lng;
        }
      } else {
        grouped.set(key, { address, lat, lng, count: 1, lastUsed: row.created_at });
      }
    });

    const sorted = [...grouped.values()].sort(
      (a, b) => b.count - a.count || (a.lastUsed < b.lastUsed ? 1 : -1),
    );

    setDestinations(sorted.slice(0, limit));
    setLoading(false);
  }, [user, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { destinations, loading, refresh: load };
}
