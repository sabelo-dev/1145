import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, type DeliveryRoute, type DriverLocation, type DriverRow, type Hub } from "./db";

export function useHubs() {
  return useQuery({
    queryKey: ["lx", "hubs"],
    queryFn: async () => {
      const { data, error } = await db.from("logistics_hubs").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Hub[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useDrivers() {
  return useQuery({
    queryKey: ["lx", "drivers"],
    queryFn: async () => {
      const { data, error } = await db
        .from("drivers")
        .select("id, user_id, name, phone, status, rating, total_deliveries, vehicle_type, vehicle_registration")
        .order("name");
      if (error) throw error;
      return (data ?? []) as DriverRow[];
    },
  });
}

export function useDriverLocations() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["lx", "driver-locations"],
    queryFn: async () => {
      const { data, error } = await db
        .from("driver_locations")
        .select("driver_id, latitude, longitude, is_online, is_available, last_updated");
      if (error) throw error;
      return (data ?? []).map((d) => ({ ...d, latitude: Number(d.latitude), longitude: Number(d.longitude) })) as DriverLocation[];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const channel = db
      .channel("lx-driver-locations")
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, () =>
        qc.invalidateQueries({ queryKey: ["lx", "driver-locations"] }),
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

export function useAccounts() {
  return useQuery({
    queryKey: ["lx", "accounts", "options"],
    queryFn: async () => {
      const { data, error } = await db.from("logistics_accounts").select("id, name, status, discount_pct").order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; status: string; discount_pct: number }>;
    },
    staleTime: 5 * 60_000,
  });
}

export function useVehicles() {
  return useQuery({
    queryKey: ["lx", "vehicles"],
    queryFn: async () => {
      const { data, error } = await db.from("vehicles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOpenRoutes() {
  return useQuery({
    queryKey: ["lx", "routes", "open"],
    queryFn: async () => {
      const { data, error } = await db
        .from("delivery_routes")
        .select("*")
        .in("status", ["draft", "planned", "dispatched", "in_progress"])
        .order("route_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DeliveryRoute[];
    },
  });
}

/** Invalidate a set of logistics queries whenever any of `tables` change. */
export function useRealtimeInvalidate(channelName: string, tables: string[], keys: unknown[][]) {
  const qc = useQueryClient();
  useEffect(() => {
    let channel = db.channel(channelName);
    for (const table of tables) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      });
    }
    channel.subscribe();
    return () => {
      db.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, qc]);
}
