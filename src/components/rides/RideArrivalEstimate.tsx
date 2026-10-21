import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
interface Arrival { destination: "pickup" | "dropoff"; minutes: number; distanceKm: number; trafficDelayMinutes: number; updatedAt: string; arrivalAt: string; }
export default function RideArrivalEstimate({ rideId, status }: { rideId: string; status: string }) {
  const estimate = useQuery({ queryKey: ["ride-arrival", rideId, status], enabled: ["accepted", "arriving", "arrived", "in_progress"].includes(status), refetchInterval: 30_000, retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ride-arrival", { body: { rideId } });
      if (error || !data?.trafficAware) throw new Error("Live estimate unavailable");
      return data as Arrival;
    },
  });
  if (!["accepted", "arriving", "arrived", "in_progress"].includes(status)) return null;
  const value = estimate.data;
  const fresh = value && Date.now() - Date.parse(value.updatedAt) < 90_000 && !estimate.isError;
  return <section className="space-y-1 rounded-xl border bg-card p-4" aria-live="polite">
    <h2 className="font-semibold">{status === "in_progress" ? "Estimated destination arrival" : "Your driver's arrival"}</h2>
    {status === "arrived" ? <p>Your driver is at the pickup.</p> : fresh ? <>
      <p className="text-lg font-bold">About {value.minutes} min ? {value.distanceKm.toFixed(1)} km by road</p>
      <p className="text-sm">Around {new Date(value.arrivalAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      <p className="text-xs text-muted-foreground">Live traffic estimate{value.trafficDelayMinutes > 0 ? ` ? about ${value.trafficDelayMinutes} min traffic delay` : ""}. Updates every 30 seconds; conditions can change.</p>
    </> : <p className="text-sm text-muted-foreground">{estimate.isLoading ? "Checking the road route and traffic..." : "Live arrival estimate unavailable. Waiting for updated location or traffic data."}</p>}
  </section>;
}
